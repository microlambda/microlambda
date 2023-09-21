import { IDeployCmd } from '../utils/deploy/cmd-options';
import { ICommandResult, RunCommandEventEnum, Runner } from '@microlambda/runner-core';
import { resolveProjectRoot } from '@microlambda/utils';
import { beforeDeploy } from '../utils/deploy/pre-requisites';
import { EventLogsFileHandler, EventsLog } from '@microlambda/logger';
import { logger } from '../utils/logger';
import chalk from 'chalk';
import { printAccountInfos } from './envs/list';
import { getConcurrency } from '../utils/get-concurrency';
import { resolveEnvs } from '@microlambda/core';
import { SSMResolverMode } from '@microlambda/environments';
import { checkIfEnvIsLock } from '../utils/check-env-lock';
import { prompt } from 'inquirer';
import Table from 'cli-table3';
import { IServiceInstance } from '@microlambda/remote-state';
import { resolveDeltas } from '../utils/deploy/resolve-deltas';
import { DeployEvent, printReport, RemoveEvent } from '../utils/deploy/print-report';
import { from, Observable, of } from 'rxjs';
import { catchError, concatAll, map, mergeAll, tap } from 'rxjs/operators';
import { MilaSpinnies } from '../utils/spinnies';
import { handleNext } from '../utils/deploy/handle-next';

export const remove = async (cmd: IDeployCmd): Promise<void> => {
  const projectRoot = resolveProjectRoot();
  const eventsLog = new EventsLog(undefined, [new EventLogsFileHandler(projectRoot, `mila-remove-${Date.now()}`)]);

  const { env, project, state, config, services } = await beforeDeploy(cmd, eventsLog);

  const runner = new Runner(project, getConcurrency(cmd.c), eventsLog);

  logger.lf();
  logger.info(chalk.underline(chalk.bold('▼ Account informations')));
  logger.lf();
  await printAccountInfos();

  const releaseLock = await checkIfEnvIsLock(cmd, env, project, config);

  const servicesInstances = await state.listServices(cmd.e);

  const allRegions = [...env.regions];

  const table = new Table({
    head: ['Service', ...allRegions],
    style: {
      head: ['cyan'],
    },
  });

  const deployedServicesInstancesGroupedByName = new Map<string, Map<string, IServiceInstance>>();

  for (const servicesInstance of servicesInstances) {
    const deployedServicesInstances = deployedServicesInstancesGroupedByName.get(servicesInstance.name);
    if (deployedServicesInstances) {
      deployedServicesInstances.set(servicesInstance.region, servicesInstance);
    } else {
      deployedServicesInstancesGroupedByName.set(
        servicesInstance.name,
        new Map([[servicesInstance.region, servicesInstance]]),
      );
    }
  }

  for (const [serviceName, instancesByRegion] of deployedServicesInstancesGroupedByName.entries()) {
    const row = [chalk.bold(serviceName)];
    for (const region of env.regions) {
      const serviceInstance = instancesByRegion.get(region);
      row.push(serviceInstance?.sha1 ?? '-');
    }
    table.push(row);
  }

  // eslint-disable-next-line no-console
  console.log(table.toString());

  try {
    const operations = await resolveDeltas(env, project, cmd, state, config, eventsLog);
    if (cmd.onlyPrompt) {
      logger.info('Not performing destroy as --only-prompt option has been given');
      await releaseLock();
      process.exit(0);
    }
    if (cmd.prompt) {
      const answers = await prompt([
        {
          type: 'confirm',
          name: 'ok',
          message: `Are you sure you want to execute this remove on ${chalk.magenta.bold(env.name)}`,
        },
      ]);
      if (!answers.ok) {
        await releaseLock();
        process.exit(2);
      }
    }

    // Source env
    const envs = await resolveEnvs(project, cmd.e, SSMResolverMode.ERROR, eventsLog.scope('remove/env'));

    logger.lf();
    logger.info('▼ Removing services');
    logger.lf();

    const failures: Set<DeployEvent> = new Set();
    const actions: Set<DeployEvent> = new Set();
    const removeCommands$: Array<Observable<DeployEvent>> = [];
    logger.debug('Preparing remove commands');
    for (const [serviceName, serviceOperations] of operations.entries()) {
      logger.debug('Processing', serviceName);
      const service = project.services.get(serviceName);
      if (!service) {
        logger.error('Unexpected error:', serviceName, 'cannot be resolved as a service locally');
        await releaseLock();
        process.exit(1);
      }
      const removeServiceInAllRegions$: Array<Observable<RemoveEvent>> = [];
      for (const [region, type] of serviceOperations.entries()) {
        logger.debug('Processing', serviceName, 'in region', region, type);
        if (['destroy'].includes(type)) {
          logger.debug('Executing mila-runner command', {
            mode: 'parallel',
            workspaces: [service.name],
            cmd: 'destroy',
            env: {
              AWS_REGION: region,
            },
            stdio: cmd.verbose ? 'inherit' : 'pipe',
          });
          for (const env of envs.values()) {
            env.AWS_REGION = region;
          }
          const remove$ = runner.runCommand({
            mode: 'parallel',
            workspaces: [service],
            cmd: 'destroy',
            env: envs,
            stdio: cmd.verbose ? 'inherit' : 'pipe',
          });
          /*
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
             */
          removeServiceInAllRegions$.push(remove$);
        }
      }
      removeCommands$.push(from(removeServiceInAllRegions$).pipe(concatAll()));
    }
    const spinnies = new MilaSpinnies(cmd.verbose);
    const removeProcess$ = from(removeCommands$).pipe(mergeAll(getConcurrency(cmd.c)));
    removeProcess$.subscribe({
      next: (evt) => {
        handleNext(evt, spinnies, failures, actions, cmd.verbose, 'remove');
      },
      error: async (err) => {
        logger.error('Unexpected error happened during removing process', err);
        await releaseLock();
        process.exit(1);
      },
      complete: async () => {
        if (failures.size) {
          await printReport(actions, failures, removeCommands$.length, 'remove', cmd.verbose);
          await releaseLock();
          process.exit(1);
        }
        await releaseLock();
        logger.success(`Successfully remove ${cmd.e} 🚀`);
        process.exit(0);
      },
    });
  } catch (e) {
    logger.error('Remove failed', e);
    await releaseLock();
    process.exit(1);
  }
};
