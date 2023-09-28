import {IEnvironment, State} from '@microlambda/remote-state';
import {concatAll, from, Observable, of} from 'rxjs';
import {SharedInfraDeployEvent, SharedInfraDeployEventType} from './types';
import {IBaseLogger} from '@microlambda/types';
import {Workspace} from "../graph/workspace";
import {RunCommandEventEnum, Runner} from "@microlambda/runner-core";
import {IRootConfig} from "@microlambda/config";
import {Project} from "../graph/project";

const runSlsCommand = (
  params: {
    workspace: Workspace;
    config: IRootConfig;
    env: string;
    action: 'deploy' | 'remove';
    region: string;
    state: State;
    verbose: boolean;
    force: boolean;
    project: Project,
    concurrency: number;
    currentRevision: string;
  },
  logger?: IBaseLogger,
): Observable<SharedInfraDeployEvent> => {
  const { action, region, verbose, env, workspace, force, currentRevision, state, config, project, concurrency } = params;

  return new Observable<SharedInfraDeployEvent>((obs) => {
    logger?.debug('starting evt', workspace.name, env, region, action);
    obs.next({
      type: action === 'deploy' ? SharedInfraDeployEventType.DEPLOYING : SharedInfraDeployEventType.REMOVING,
      region,
      env: env,
      workspace,
    });

    const _env = workspace._config.sharedInfra?.envSpecific ? env : undefined;
    const cachePrefix =
      workspace._config.sharedInfra?.envSpecific
      ? `caches/${workspace.name}/${action}/${region}`
      : `caches/${workspace.name}/${action}/${env}/${region}`;

    const runner = new Runner(project, concurrency);
    runner.runCommand({
      cmd: `infra:${action}`,
      mode: 'parallel',
      workspaces: [workspace],
      env: {
        ...process.env,
        AWS_REGION: region,
        ENV: env,
      },
      force: action === 'remove' || force,
      stdio: verbose ? 'inherit' : 'pipe',
      remoteCache: action === 'deploy' ? {
        region: config.defaultRegion,
        bucket: config.state.checksums,
      } : undefined,
      cachePrefix,
    }).subscribe({
      next: (evt) => {
        switch (evt.type) {
          case RunCommandEventEnum.NODE_STARTED:
            obs.next({
              type: action === 'deploy' ? SharedInfraDeployEventType.DEPLOYING : SharedInfraDeployEventType.REMOVING,
              region,
              env: env,
              workspace,
            });
            break;
          case RunCommandEventEnum.NODE_SKIPPED:
            obs.next({
              type: SharedInfraDeployEventType.NO_CHANGES,
              region,
              env: env,
              workspace,
            });
            break;
          case RunCommandEventEnum.NODE_PROCESSED:
            const action$ = action === 'deploy'
              ? state.setSharedInfrastructureState({
                name: workspace.name,
                region,
                env: _env,
                sha1: currentRevision,
                checksums_buckets: config.state.checksums,
                checksums_key: `${cachePrefix}/${currentRevision}/checksums.json`,
              })
              : state.deleteSharedInfrastructureState(workspace.name, region, env);
            action$
              .catch((e) => {
                logger?.warn(e);
              })
              .finally(() => {
                obs.next({
                  type: action === 'deploy' ? SharedInfraDeployEventType.DEPLOYED : SharedInfraDeployEventType.REMOVED,
                  region,
                  env: env,
                  workspace,
                  result: evt.result,
                });
              })
            break;
          case RunCommandEventEnum.NODE_ERRORED:
            obs.next({
              type: action === 'deploy' ? SharedInfraDeployEventType.FAILED_DEPLOY : SharedInfraDeployEventType.FAILED_REMOVE,
              region,
              env: env,
              workspace,
              err: evt.error,
            });
            break;
        }
      },
      error: (err) => {
        obs.next({
          type: action === 'deploy' ? SharedInfraDeployEventType.FAILED_DEPLOY : SharedInfraDeployEventType.FAILED_REMOVE,
          region,
          env: env,
          workspace,
          err,
        });
      },
      complete: () => obs.complete(),
    })
  });
};

/**
 * Deploy a shared infrastructure stack using sls deploy command in each region
 * the environment is replicated on.
 * ENV and AWS_REGION are automatically populated.
 * @param params
 * @param logger
 */
export const deploySharedInfraStack = (params: {
  env: IEnvironment,
  workspace: Workspace,
  state: State,
  config: IRootConfig,
                                         verbose: boolean,
                                         force: boolean,
                                         project: Project,
                                         concurrency: number,
                                         currentRevision: string,
},
  logger?: IBaseLogger,
): Observable<SharedInfraDeployEvent> => {
  const { env, workspace, state, config, verbose, force, currentRevision, concurrency, project } = params;
  logger?.debug('Preparing update for workspace', workspace.name, env.name);
  return new Observable<SharedInfraDeployEvent>((obs) => {
    const _env = workspace._config.sharedInfra?.envSpecific ? env.name : undefined;
    state
      .getSharedInfrastructureState(workspace.name, _env)
      .then((sharedInfraState) => {
        logger?.debug(sharedInfraState);
        const regionalDeployment$: Array<Observable<SharedInfraDeployEvent>> = [];
        for (const region of env.regions) {
          logger?.debug('Resolving operations for', workspace.name, env.name, region);
          regionalDeployment$.push(
            runSlsCommand(
              {
                workspace,
                config,
                env: env.name,
                action: 'deploy',
                region,
                state,
                verbose,
                force,
                project,
                concurrency,
                currentRevision,
              },
              logger,
            ),
          );
        }
        const allRegion = new Set<string>();
        for (const region of sharedInfraState.map((s) => s.region)) {
          allRegion.add(region);
        }
        logger?.debug('All region found in state', allRegion);
        for (const region of allRegion) {
          if (!env.regions.includes(region)) {
            logger?.debug('Environment', env.name, 'is no more replicated in', region);
            regionalDeployment$.push(
              runSlsCommand({
                workspace,
                config,
                env: env.name,
                action: 'remove',
                region,
                state,
                verbose,
                force: true,
                project,
                concurrency,
                currentRevision,
              }, logger),
            );
          }
        }
        from(regionalDeployment$)
          .pipe(concatAll())
          .subscribe({
            next: (evt) => obs.next(evt),
            error: (err) => obs.error(err),
            complete: () => obs.complete(),
          });
      })
      .catch((err) => obs.error(err));
  });
};

export const removeSharedInfraStack = (
  params: {
    env: IEnvironment,
    workspace: Workspace,
    state: State,
    config: IRootConfig,
    verbose: boolean;
    currentRevision: string;
    concurrency: number;
    project: Project;
  },
  logger?: IBaseLogger,
): Observable<SharedInfraDeployEvent> => {
  const { env, workspace, state, config, verbose, currentRevision, concurrency, project } = params;

  logger?.debug('Preparing update for stack', workspace.name, env.name);
  const regionalDeployment$: Array<Observable<SharedInfraDeployEvent>> = [];
  for (const region of env.regions) {
    regionalDeployment$.push(
      runSlsCommand(
        {
          workspace,
          config,
          env: env.name,
          action: 'remove',
          region,
          state,
          verbose,
          force: true,
          project,
          concurrency,
          currentRevision,
        },
        logger,
      ),
    );
  }
  return from(regionalDeployment$).pipe(concatAll())
};
