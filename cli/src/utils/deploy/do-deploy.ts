import { prompt } from 'inquirer';
import chalk from 'chalk';
import { ICommandResult, RunCommandEventEnum, Runner, Workspace } from '@microlambda/runner-core';
import { logger } from '../logger';
import { beforePackage } from '../package/before-package';
import { MilaSpinnies } from '../spinnies';
import { Project } from '@microlambda/core';
import { packageServices } from '../package/do-package';
import { DeployEvent, printReport, RemoveEvent } from './print-report';
import { from, Observable, of } from 'rxjs';
import { catchError, concatAll, map, mergeAll, tap } from 'rxjs/operators';
import { handleNext } from './handle-next';
import { IDeployCmd } from './cmd-options';
import { Operations } from './resolve-deltas';
import { IEnvironment, State } from '@microlambda/remote-state';
import { IRootConfig } from '@microlambda/config';
import { EnvsResolver } from './envs';
import { EventsLog } from '@microlambda/logger';
import { deploySharedInfra } from '../shared-infra/deploy';
import { SSMResolverMode } from '@microlambda/environments';

export const performDeploy = async (params: {
  cmd: IDeployCmd;
  releaseLock: (msg?: string) => Promise<void>;
  operations: Operations;
  env: IEnvironment;
  project: Project;
  projectRoot: string;
  config: IRootConfig;
  envs: EnvsResolver;
  eventsLog: EventsLog;
  state: State;
  currentRevision: string;
}): Promise<void> => {
  const { cmd, releaseLock, operations, env, project, config, envs, eventsLog, state, currentRevision } = params;
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

  await deploySharedInfra({
    action: 'deploy',
    project,
    config,
    env,
    concurrency: cmd.c,
    isVerbose: cmd.verbose,
    releaseLock,
    currentRevision,
    force: cmd.force,
    onlyEnvSpecific: false,
  });

  if (toDeploy.size) {
    try {
      await packageServices(options, await envs.resolve(config.defaultRegion), eventsLog);
    } catch (e) {
      await releaseLock();
    }
  }

  logger.lf();
  logger.info(chalk.underline(chalk.bold('▼ Deploying services')));
  logger.lf();

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
        const cachePrefix = `caches/${service.name}/deploy/${env.name}/${region}`;
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
        const runner = new Runner(project, 1, eventsLog);
        const deploy$ = runner
          .runCommand({
            mode: 'parallel',
            workspaces: [service],
            cmd: 'deploy',
            env: await envs.resolve(region),
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
              action: 'deploy' as const,
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
                action: 'deploy' as const,
                error: err,
                target: { workspace: service, hasCommand: true },
                region,
              } as DeployEvent;
              return of(evt);
            }),
          );
        deployServiceInAllRegions$.push(deploy$);
      }
      if (type === 'destroy') {
        const runner = new Runner(project, 1, eventsLog);
        const remove$: Observable<RemoveEvent> = runner
          .runCommand({
            mode: 'parallel',
            workspaces: [service],
            cmd: 'destroy',
            env: await envs.resolve(region, SSMResolverMode.WARN),
            stdio: cmd.verbose ? 'inherit' : 'pipe',
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
                action: 'remove',
                target: { workspace: service, hasCommand: true },
                region,
              };
              return of(evt as RemoveEvent);
            }),
          );
        deployServiceInAllRegions$.push(remove$);
      }
    }
    deployCommands$.push(from(deployServiceInAllRegions$).pipe(concatAll()));
  }
  const spinnies = new MilaSpinnies(options.verbose);
  const deployProcess$ = from(deployCommands$).pipe(mergeAll(options.concurrency));
  return new Promise<void>((resolve, reject) => {
    deployProcess$.subscribe({
      next: (evt) => {
        handleNext(evt, spinnies, failures, actions, options.verbose);
      },
      error: async (err) => {
        logger.error('Unexpected error happened during deploy process', err);
        await releaseLock();
        return reject(err);
      },
      complete: async () => {
        if (failures.size) {
          await printReport(actions, failures, deployCommands$.length, 'deploy', options.verbose);
          await releaseLock();
          return reject();
        }
        await releaseLock();
        logger.lf();
        logger.success(`Successfully deploy ${cmd.e} 🚀`);
        return resolve();
      },
    });
  });
};
