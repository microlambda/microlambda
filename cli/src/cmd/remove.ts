import { IDeployCmd } from '../utils/deploy/cmd-options';
import { RunCommandEventEnum, Runner} from '@microlambda/runner-core';
import { resolveProjectRoot } from '@microlambda/utils';
import { beforeDeploy } from '../utils/deploy/pre-requisites';
import { EventLogsFileHandler, EventsLog } from '@microlambda/logger';
import { logger } from '../utils/logger';
import chalk from 'chalk';
import { printAccountInfos } from './envs/list';
import { getConcurrency } from '../utils/get-concurrency';
import {checkIfEnvIsLock, releaseLockOnProcessExit} from '../utils/check-env-lock';
import { prompt } from 'inquirer';
import Table from 'cli-table3';
import { IServiceInstance } from '@microlambda/remote-state';
import { printReport, RemoveEvent } from '../utils/deploy/print-report';
import { from, Observable, of } from 'rxjs';
import { catchError, concatAll, map, mergeAll, tap } from 'rxjs/operators';
import { MilaSpinnies } from '../utils/spinnies';
import { handleNext } from '../utils/deploy/handle-next';
import {EnvsResolver} from "../utils/deploy/envs";

export const remove = async (cmd: IDeployCmd): Promise<void> => {
  const projectRoot = resolveProjectRoot();
  const eventsLog = new EventsLog(undefined, [new EventLogsFileHandler(projectRoot, `mila-remove-${Date.now()}`)]);

  const { env, project, state, config, services } = await beforeDeploy(cmd, eventsLog);

  logger.lf();
  logger.info(chalk.underline(chalk.bold('▼ Account informations')));
  logger.lf();
  await printAccountInfos();

  const releaseLock = await checkIfEnvIsLock(cmd, env, project, config);
  releaseLockOnProcessExit(releaseLock);

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
    if (services && !services.some((s) => s.name === servicesInstance.name)) {
      continue;
    }
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

  if (deployedServicesInstancesGroupedByName.size < 1) {
    await releaseLock();
    logger.lf()
    logger.success('Nothing to do');
    process.exit(0);
  }

  for (const [serviceName, instancesByRegion] of deployedServicesInstancesGroupedByName.entries()) {
    const row = [chalk.bold(serviceName)];
    for (const region of env.regions) {
      const serviceInstance = instancesByRegion.get(region);
      row.push(serviceInstance ? `${chalk.bold.red('destroy')} (${serviceInstance.sha1.slice(0, 6)})` : chalk.grey('not deployed'));
    }
    table.push(row);
  }

  // eslint-disable-next-line no-console
  console.log(table.toString());

  try {
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
    const envs = new EnvsResolver(project, env.name, eventsLog.scope('remove/env'));

    logger.lf();
    logger.info(chalk.underline(chalk.bold('▼ Removing services')));
    logger.lf();

    const failures: Set<RemoveEvent> = new Set();
    const actions: Set<RemoveEvent> = new Set();
    const removeCommands$: Array<Observable<RemoveEvent>> = [];

    for (const [serviceName, serviceInstancesByRegions] of deployedServicesInstancesGroupedByName.entries()) {
      const service = project.services.get(serviceName);
      if (!service) {
        logger.error('Unexpected error:', serviceName, 'cannot be resolved as a service locally');
        await releaseLock();
        process.exit(1);
      }
      const removeServiceInAllRegions$: Array<Observable<RemoveEvent>> = [];
      for (const [region] of serviceInstancesByRegions.entries()) {

        const runner = new Runner(project, 1, eventsLog);
        const remove$: Observable<RemoveEvent> = runner.runCommand({
          mode: 'parallel',
          workspaces: [service],
          cmd: 'destroy',
          env: await envs.resolve(region),
          stdio: cmd.verbose ? 'inherit' : 'pipe',
        }).pipe(
            map((evt) => ({
              ...evt,
              region,
              action: 'remove' as const,
            })),
            tap(async (evt) => {
              if (evt.type === RunCommandEventEnum.NODE_PROCESSED) {
                await state.removeServiceInstances({env: env.name, service: service.name, region});
              }
            }),
            catchError((err) => {
              const evt = {
                type: RunCommandEventEnum.NODE_ERRORED,
                error: err,
                target: { workspace: service, hasCommand: true },
                region,
                action: 'remove' as const,
              };
              return of(evt as RemoveEvent);
            }),
          );
        removeServiceInAllRegions$.push(remove$);
      }
      removeCommands$.push(from(removeServiceInAllRegions$).pipe(concatAll()));
    }

    const spinnies = new MilaSpinnies(cmd.verbose);
    const removeProcess$ = from(removeCommands$).pipe(mergeAll(getConcurrency(cmd.c)));
    removeProcess$.subscribe({
      next: (evt) => {
        handleNext(evt, spinnies, failures, actions, cmd.verbose);
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
        logger.lf();
        logger.success(`Successfully removed ${cmd.e} 🚀`);
        process.exit(0);
      },
    });
  } catch (e) {
    logger.error('Remove failed', e);
    await releaseLock();
    process.exit(1);
  }
};
