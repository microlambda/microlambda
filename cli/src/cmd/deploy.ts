import chalk from 'chalk';
import { prompt } from 'inquirer';
import { tap, catchError, mergeAll, map, concatAll } from 'rxjs/operators';
import { logger } from '../utils/logger';
import { LockManager } from '@microlambda/remote-state';
import { resolveDeltas } from '../utils/deploy/resolve-deltas';
import { beforeDeploy } from '../utils/deploy/pre-requisites';
import { IDeployCmd } from '../utils/deploy/cmd-options';
import { EventLogsFileHandler, EventsLog } from '@microlambda/logger';
import { resolveProjectRoot } from '@microlambda/utils';
import { packageServices } from '../utils/package/do-package';
import { currentSha1, ICommandResult, RunCommandEventEnum, Runner, Workspace } from '@microlambda/runner-core';
import { printAccountInfos } from './envs/list';
import ora from 'ora';
import { beforePackage } from '../utils/package/before-package';
import { from, Observable, of } from 'rxjs';
import { DeployEvent, printReport } from '../utils/deploy/print-report';
import { handleNext } from '../utils/deploy/handle-next';
import { MilaSpinnies } from '../utils/spinnies';
import {
  deploySharedInfrastructure,
  ISharedInfraFailedDeployEvent,
  SharedInfraDeployEventType,
} from '@microlambda/core';
import { getConcurrency } from '../utils/get-concurrency';
import { relative } from 'path';

export const deploy = async (cmd: IDeployCmd): Promise<void> => {
  logger.lf();
  logger.info(chalk.underline(chalk.bold('▼ Preparing deployment')));
  logger.lf();

  const projectRoot = resolveProjectRoot();
  const eventsLog = new EventsLog(undefined, [new EventLogsFileHandler(projectRoot, `mila-deploy-${Date.now()}`)]);

  const { env, project, state, config } = await beforeDeploy(cmd, eventsLog);
  logger.lf();
  logger.info(chalk.underline(chalk.bold('▼ Account informations')));
  logger.lf();
  await printAccountInfos();
  const currentRevision = currentSha1();

  let lock: LockManager | undefined;
  if (!cmd.skipLock) {
    lock = new LockManager(config, env.name, cmd.s?.split(',') || [...project.services.keys()]);
    if (await lock.isLocked()) {
      logger.lf();
      logger.info('🔒 Environment is locked. Waiting for the lock to be released');
      await lock.waitLockToBeReleased();
    }
    await lock.lock();
  }

  const releaseLock = async (msg?: string): Promise<void> => {
    if (lock) {
      try {
        logger.lf();
        const lockRelease = ora(msg || '🔒 Releasing lock...');
        await lock?.releaseLock();
        lockRelease.succeed('🔒 Lock released !');
      } catch (e) {
        logger.error('Error releasing lock, you probably would have to do it yourself !', e);
        throw e;
      }
    }
  };
  process.on('SIGINT', async () => {
    eventsLog.scope('process').warn('SIGINT signal received');
    try {
      await releaseLock('🔒 SIGINT received, releasing lock...');
      process.exit(0);
    } catch (e) {
      logger.error('Error releasing lock, you probably would have to do it yourself !');
      process.exit(2);
    }
  });
  try {
    const operations = await resolveDeltas(env, project, cmd, state, config, eventsLog);
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
      const isDeployedInAtLeastOneRegion = [...serviceOps.values()].some((action) =>
        ['redeploy', 'first_deploy'].includes(action),
      );
      if (service && isDeployedInAtLeastOneRegion) {
        toDeploy.add(service);
      }
    }

    const toDestroy = new Set<Workspace>();
    for (const [serviceName, serviceOps] of operations.entries()) {
      const service = project.services.get(serviceName);
      const shouldBeDestroyedFromAtLeastOneRegion = [...serviceOps.values()].some((action) =>
        ['destroy'].includes(action),
      );
      if (service && shouldBeDestroyedFromAtLeastOneRegion) {
        toDestroy.add(service);
      }
    }

    if (!toDeploy.size && !toDestroy.size) {
      logger.lf();
      logger.success('Nothing to do 👌');
      await releaseLock();
      process.exit(0);
    }

    const options = await beforePackage(
      project,
      {
        ...cmd,
        s: [...toDeploy].map((s) => s.name).join(','),
      },
      eventsLog,
    );
    logger.lf();
    logger.info(chalk.underline(chalk.bold('▼ Updating shared infrastructure')));
    logger.lf();
    await new Promise<void>((resolve) => {
      const spinnies = new MilaSpinnies(options.verbose);
      const failures = new Set<ISharedInfraFailedDeployEvent>();
      deploySharedInfrastructure(projectRoot, config, env, getConcurrency(cmd.c)).subscribe({
        next: (evt) => {
          switch (evt.type) {
            case SharedInfraDeployEventType.STACKS_RESOLVED:
              if (!evt.stacks.length) {
                logger.success('Nothing to do 👌');
              }
              break;
            case SharedInfraDeployEventType.STARTED:
              spinnies.add(
                `${evt.stack}-${evt.region}`,
                `Deploying ${relative(projectRoot, evt.stack)} (${evt.region})`,
              );
              break;
            case SharedInfraDeployEventType.SUCCEEDED:
              spinnies.succeed(
                `${evt.stack}-${evt.region}`,
                `Successfully deployed ${relative(projectRoot, evt.stack)} (${evt.region})`,
              );
              break;
            case SharedInfraDeployEventType.FAILED:
              spinnies.fail(
                `${evt.stack}-${evt.region}`,
                `Failed to deploy ${relative(projectRoot, evt.stack)} (${evt.region})`,
              );
              failures.add(evt as ISharedInfraFailedDeployEvent);
              break;
          }
        },
        error: (err) => {
          logger.error('Error happened updating shared infrastructure');
          logger.error(err);
          process.exit(1);
        },
        complete: () => {
          if (failures.size) {
            logger.error('Error happened updating shared infrastructure');
            for (const failure of failures) {
              logger.error(
                `Error happened deploying ${relative(projectRoot, failure.stack)} in region ${failure.region}`,
              );
              const isExecaError = (err: unknown): err is { all: string } => !!(failure.err as { all: string }).all;
              if (isExecaError(failure.err)) {
                logger.error(failure.err.all);
              } else {
                logger.error(failure.err);
              }
            }
            process.exit(1);
          }
          return resolve();
        },
      });
    });

    await packageServices(options, eventsLog);

    logger.lf();
    logger.info('▼ Deploying services');
    logger.lf();

    const runner = new Runner(project, options.concurrency);
    const failures: Set<DeployEvent> = new Set();
    const actions: Set<DeployEvent> = new Set();
    const deployCommands$: Array<Observable<DeployEvent>> = [];
    logger.debug('Preparing deploy commands');
    for (const [serviceName, serviceOperations] of operations.entries()) {
      logger.debug('Processing', serviceName);
      const service = project.services.get(serviceName);
      if (!service) {
        logger.error('Unexpected error:', serviceName, 'cannot be resolved as a service locally');
        await releaseLock();
        process.exit(1);
      }
      const deployServiceInAllRegions$: Array<Observable<DeployEvent>> = [];
      for (const [region, type] of serviceOperations.entries()) {
        logger.debug('Processing', serviceName, 'in region', region, type);
        if (['first_deploy', 'redeploy'].includes(type)) {
          const cachePrefix = `caches/${service.name}/deploy/${region}`;
          logger.debug('Executing mila-runner command', {
            mode: 'parallel',
            workspaces: [service.name],
            cmd: 'deploy',
            env: {
              AWS_REGION: region,
            },
            stdio: options.verbose ? 'inherit' : 'pipe',
            remoteCache: {
              region: config.defaultRegion,
              bucket: config.state.checksums,
            },
            cachePrefix,
          });
          const deploy$ = runner
            .runCommand({
              mode: 'parallel',
              workspaces: [service],
              cmd: 'deploy',
              env: {
                AWS_REGION: region,
              },
              stdio: options.verbose ? 'inherit' : 'pipe',
              remoteCache: {
                region: config.defaultRegion,
                bucket: config.state.checksums,
              },
              cachePrefix,
            })
            .pipe(
              map((evt) => ({
                ...evt,
                region,
              })),
              tap(async (evt) => {
                if (evt.type === RunCommandEventEnum.NODE_PROCESSED) {
                  if (evt.result.commands.every((cmd) => (cmd as ICommandResult).exitCode === 0)) {
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
                }
              }),
              catchError((err) => {
                const evt = {
                  type: RunCommandEventEnum.NODE_ERRORED,
                  error: err,
                  target: { workspace: service, hasCommand: true },
                  region,
                } as DeployEvent;
                return of(evt);
              }),
            );
          deployServiceInAllRegions$.push(deploy$);
        }
      }
      deployCommands$.push(from(deployServiceInAllRegions$).pipe(concatAll()));
    }
    const spinnies = new MilaSpinnies(options.verbose);
    const deployProcess$ = from(deployCommands$).pipe(mergeAll(options.concurrency));
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
    });
  } catch (e) {
    logger.error('Deployment failed', e);
    await releaseLock();
    process.exit(1);
  }
};
