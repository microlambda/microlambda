import chalk from 'chalk';
import {prompt} from 'inquirer';
import { tap, catchError, mergeAll, map } from 'rxjs/operators';
import { logger } from '../utils/logger';
import { LockManager } from '@microlambda/remote-state';
import { resolveDeltas } from '../utils/deploy/resolve-deltas';
import { beforeDeploy } from '../utils/deploy/pre-requisites';
import { IDeployCmd } from '../utils/deploy/cmd-options';
import { EventLogsFileHandler, EventsLog } from '@microlambda/logger';
import { resolveProjectRoot } from '@microlambda/utils';
import { packageServices } from '../utils/package/do-package';
import {
  currentSha1,
  RunCommandEventEnum,
  Runner,
  Workspace,
} from '@microlambda/runner-core';
import { printAccountInfos } from './envs/list';
import ora from 'ora';
import { beforePackage } from '../utils/package/before-package';
import { from, Observable, of } from 'rxjs';
import { DeployEvent, printReport } from '../utils/deploy/print-report';
import { handleNext } from '../utils/deploy/handle-next';
import Spinnies from 'spinnies';



export const deploy = async (cmd: IDeployCmd): Promise<void> => {
  logger.lf();
  logger.info(chalk.underline(chalk.bold('▼ Preparing deployment')));
  logger.lf();

  const projectRoot = resolveProjectRoot();
  const eventsLog = new EventsLog(undefined, [new EventLogsFileHandler(projectRoot, `mila-deploy-${Date.now()}`)]);

  const { env, project, state, config } = await beforeDeploy(cmd);
  logger.lf();
  logger.info(chalk.underline(chalk.bold('▼ Account informations')));
  logger.lf();
  await printAccountInfos();
  const currentRevision = currentSha1();
  const lock = new LockManager(config);
  if (await lock.isLocked(env.name)) {
    logger.lf();
    logger.info('🔒 Environment is locked. Waiting for the lock to be released');
    await lock.waitLockToBeReleased(env.name);
  }
  await lock.lock(env.name);
  const releaseLock = async (): Promise<void> => {
    logger.lf();
    const lockRelease = ora('🔒 Releasing lock...');
    await lock.releaseLock(env.name);
    lockRelease.succeed('🔒 Lock released !');
  }
  process.on('SIGINT', async () => {
    eventsLog.scope('process').warn('SIGINT signal received');
    logger.lf();
    const lockRelease = ora('🔒 SIGINT received, releasing lock...');
    try {
      await lock.releaseLock(env.name);

    } catch (e) {
      logger.error('Error releasing lock, you probably would have to do it yourself !');
      process.exit(2);
    }
    lockRelease.succeed('🔒 Lock released !');
    process.exit(0);
  });
  try {
    const operations = await resolveDeltas(env, project, cmd, state, config);
    if (cmd.onlyPrompt) {
      await releaseLock();
      process.exit(0);
    }
    if (cmd.prompt) {
      const answers = await prompt([
        {
          type: 'confirm',
          name: 'ok',
          message: `Are you sure you want to execute this deployment on ${chalk.magenta.bold(env.name)}`,
        },
      ]);
      if (!answers.ok) {
        await releaseLock();
        process.exit(2);
      }
    }

    const toDeploy = new Set<Workspace>();
    for (const [serviceName, serviceOps] of operations.entries()) {
      const service = project.services.get(serviceName);
      const isDeployedInAtLeastOneRegion = [...serviceOps.values()].some((action) => ['redeploy', 'first_deploy'].includes(action));
      if (service && isDeployedInAtLeastOneRegion) {
        toDeploy.add(service)
      }
    }

    const toDestroy = new Set<Workspace>();
    for (const [serviceName, serviceOps] of operations.entries()) {
      const service = project.services.get(serviceName);
      const shouldBeDestroyedFromAtLeastOneRegion = [...serviceOps.values()].some((action) => ['destroy'].includes(action));
      if (service && shouldBeDestroyedFromAtLeastOneRegion) {
        toDestroy.add(service)
      }
    }

    if (!toDeploy.size && !toDestroy.size) {
      logger.lf();
      logger.success('Nothing to do 👌');
      await releaseLock();
      process.exit(0);
    }

    const options = await beforePackage(project, {
      ...cmd,
      s: [...toDeploy].map((s) => s.name).join(','),
    }, eventsLog);
    await packageServices(options)

    logger.lf();
    logger.info('▼ Deploying services');
    logger.lf();

    const runner = new Runner(project, options.concurrency);
    const failures: Set<DeployEvent> = new Set();
    const actions: Set<DeployEvent> = new Set();
    const deployCommands$: Array<Observable<DeployEvent>> = [];
    for (const [serviceName, serviceOperations] of operations.entries()) {
      const service = project.services.get(serviceName);
      if (!service) {
        logger.error('Unexpected error:', serviceName, 'cannot be resolved as a service locally');
        await releaseLock();
        process.exit(1);
      }
      for (const [region, type] of serviceOperations.entries()) {
        if (['first_deploy', 'redeploy'].includes(type)) {
          const cachePrefix = `caches/${service.name}/deploy/${region}`;
          const deploy$ = runner.runCommand({
            mode: 'parallel',
            workspaces: [service],
            cmd: 'deploy',
            env: {
              AWS_REGION: region,
            },
            remoteCache: {
              region: config.defaultRegion,
              bucket: config.state.checksums,
            },
            cachePrefix,
          }).pipe(
            map((evt) => ({
              ...evt,
              region,
            })),
            tap(async (evt) => {
              if (evt.type === RunCommandEventEnum.NODE_PROCESSED) {
                try {
                  await state.createServiceInstance({
                    name: service.name,
                    region,
                    env: env.name,
                    sha1: currentRevision,
                    checksums_buckets: config.state.checksums,
                    checksums_key: `${cachePrefix}/${currentRevision}/checksums.json`,
                  });
                } catch (err) {
                  logger.warn('Error updating state for service', service.name);
                  eventsLog.scope('deploy').error('Error updating state for service', service.name, err);
                }
              }
            }),
            catchError((err) => {
              const evt = {
                type: RunCommandEventEnum.NODE_ERRORED,
                error: err,
                workspace: service,
                region,
              } as DeployEvent
              failures.add(evt)
              return of(evt);
            }),
          );
          deployCommands$.push(deploy$);
        }
      }
    }
    const spinnies = new Spinnies({
      failColor: 'white',
      succeedColor: 'white',
      spinnerColor: 'cyan',
    });
    const deployProcess$ = from(deployCommands$).pipe(
      mergeAll(options.concurrency),
    );
    deployProcess$.subscribe({
      next: (evt) => {
        handleNext(evt, spinnies, failures, actions, options.verbose, 'deploy');
      },
      error: async (err) => {
        logger.error('Unexpected error happened during deploy process', err);
        await releaseLock();
        process.exit(1);
      },
      complete: async () => {
        if (failures.size) {
          await printReport(actions, failures, deployCommands$.length, 'deploy', options.verbose);
          await releaseLock();
          process.exit(1);
        }
        await releaseLock();
        logger.success(`Successfully deploy ${cmd.e} 🚀`);
        process.exit(0);
      },
    })

  } catch (e) {
    logger.error('Deployment failed', e);
    await releaseLock();
    process.exit(1);
  }
};
