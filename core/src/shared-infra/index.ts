import { from, mergeAll, Observable } from 'rxjs';
import { SharedInfraDeployEvent, SharedInfraDeployEventType } from './types';
import { IStateConfig } from '@microlambda/config';
import { deploySharedInfraStack, removeSharedInfraStack } from './stack-deployer';
import { IEnvironment, State } from '@microlambda/remote-state';
import { IBaseLogger } from '@microlambda/types';
import { Project } from '../graph/project';
import { Workspace } from '@microlambda/runner-core';

const _applySharedInfrastructure = async (
  params: {
    action: 'deploy' | 'remove';
    project: Project;
    config: IStateConfig;
    env: IEnvironment;
    concurrency: number;
    verbose: boolean;
    force: boolean;
    currentRevision: string;
    onlyEnvSpecific: boolean;
  },
  logger?: IBaseLogger,
): Promise<Observable<SharedInfraDeployEvent>> => {
  const { action, env, concurrency, onlyEnvSpecific, project, config, verbose, force, currentRevision } = params;
  return new Observable<SharedInfraDeployEvent>((obs) => {
    const sharedInfraWorkspaces: Workspace[] = [];
    for (const workspace of project.workspaces.values()) {
      if (workspace.hasCommand('infra:deploy') && workspace.hasCommand('infra:remove')) {
        logger?.debug('Found eligible workspace', workspace.name);
        sharedInfraWorkspaces.push(workspace);
      }
    }
    logger?.debug('Deploying shared infrastructure');
    logger?.debug(
      'Stacks',
      sharedInfraWorkspaces.map((w) => w.name),
    );
    const state = new State(config.state.table, config.defaultRegion);
    obs.next({
      type: SharedInfraDeployEventType.WORKSPACES_RESOLVED,
      workspaces: sharedInfraWorkspaces,
    });
    const deployments$ = sharedInfraWorkspaces
      .filter((workspace) => !onlyEnvSpecific || workspace._config.sharedInfra?.envSpecific)
      .map((workspace) =>
        action === 'deploy'
          ? deploySharedInfraStack(
              {
                env,
                workspace,
                state,
                config,
                verbose,
                force,
                project,
                concurrency,
                currentRevision,
              },
              logger,
            )
          : removeSharedInfraStack(
              {
                env,
                workspace,
                state,
                config,
                verbose,
                project,
                concurrency,
                currentRevision,
              },
              logger,
            ),
      );
    logger?.debug('Prepared', deployments$.length, 'deploy/remove operations');
    from(deployments$)
      .pipe(mergeAll())
      .subscribe({
        next: (evt) => obs.next(evt),
        error: (err) => obs.error(err),
        complete: () => {
          logger?.debug('All operations completed');
          obs.complete();
        },
      });
  });
};

export const deploySharedInfrastructure = async (
  params: {
    project: Project;
    config: IStateConfig;
    env: IEnvironment;
    concurrency: number;
    verbose: boolean;
    force: boolean;
    currentRevision: string;
    onlyEnvSpecific: boolean;
  },
  logger?: IBaseLogger,
): Promise<Observable<SharedInfraDeployEvent>> => {
  return _applySharedInfrastructure({ action: 'deploy', ...params }, logger);
};

export const removeSharedInfrastructure = async (
  params: {
    project: Project;
    config: IStateConfig;
    env: IEnvironment;
    concurrency: number;
    verbose: boolean;
    currentRevision: string;
    onlyEnvSpecific: boolean;
  },
  logger?: IBaseLogger,
): Promise<Observable<SharedInfraDeployEvent>> => {
  return _applySharedInfrastructure({ action: 'remove', ...params, force: true }, logger);
};
