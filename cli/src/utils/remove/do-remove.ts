import {EnvsResolver} from '../deploy/envs';
import {logger} from '../logger';
import chalk from 'chalk';
import {printReport, RemoveEvent} from '../deploy/print-report';
import {from, Observable, of} from 'rxjs';
import {RunCommandEventEnum, Runner} from '@microlambda/runner-core';
import {catchError, concatAll, map, mergeAll, tap} from 'rxjs/operators';
import {MilaSpinnies} from '../spinnies';
import {getConcurrency} from '../get-concurrency';
import {handleNext} from '../deploy/handle-next';
import {Project} from '@microlambda/core';
import {IEnvironment, State} from '@microlambda/remote-state';
import {EventsLog} from '@microlambda/logger';
import {RemoveOperations} from './resolve-deltas';
import {SSMResolverMode} from "@microlambda/environments";


export const removeServices = async (params: {
  operations: RemoveOperations;
  project: Project;
  env: IEnvironment;
  eventsLog?: EventsLog;
  releaseLock: (msg?: string) => Promise<void>;
  isVerbose: boolean;
  concurrency?: string;
  state: State;
}): Promise<void> => {
  const { operations, project, env, eventsLog, releaseLock, isVerbose, concurrency, state } = params;
  // Source env
  const envs = new EnvsResolver(project, env.name, eventsLog?.scope('remove/env'));

  logger.lf();
  logger.info(chalk.underline(chalk.bold('▼ Removing services')));
  logger.lf();

  const failures: Set<RemoveEvent> = new Set();
  const actions: Set<RemoveEvent> = new Set();
  const removeCommands$: Array<Observable<RemoveEvent>> = [];

  for (const [serviceName, serviceInstancesByRegions] of operations.entries()) {
    const service = project.services.get(serviceName);
    if (!service) {
      logger.error('Unexpected error:', serviceName, 'cannot be resolved as a service locally');
      await releaseLock();
      process.exit(1);
    }
    const removeServiceInAllRegions$: Array<Observable<RemoveEvent>> = [];
    for (const [region] of serviceInstancesByRegions.entries()) {
      const runner = new Runner(project, 1, eventsLog);
      const remove$: Observable<RemoveEvent> = runner
        .runCommand({
          mode: 'parallel',
          workspaces: [service],
          cmd: 'destroy',
          env: await envs.resolve(region, SSMResolverMode.WARN),
          stdio: isVerbose ? 'inherit' : 'pipe',
          force: true,
        })
        .pipe(
          map((evt) => ({
            ...evt,
            region,
            action: 'remove' as const,
          })),
          tap(async (evt) => {
            if (evt.type === RunCommandEventEnum.NODE_PROCESSED) {
              await state.removeServiceInstances({ env: env.name, service: service.name, region });
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

  const spinnies = new MilaSpinnies(isVerbose);
  const removeProcess$ = from(removeCommands$).pipe(mergeAll(getConcurrency(concurrency)));
  return new Promise((resolve, reject) => {
    removeProcess$.subscribe({
      next: (evt) => {
        handleNext(evt, spinnies, failures, actions, isVerbose);
      },
      error: async (err) => {
        logger.error('Unexpected error happened during removing process', err);
        await releaseLock();
        return reject(err);
      },
      complete: async () => {
        if (failures.size) {
          await printReport(actions, failures, removeCommands$.length, 'remove', isVerbose);
          await releaseLock();
          return reject();
        }
        return resolve();
      },
    });
  });
};
