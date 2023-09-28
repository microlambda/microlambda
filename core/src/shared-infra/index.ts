import { from, mergeAll, Observable } from 'rxjs';
import { SharedInfraDeployEvent, SharedInfraDeployEventType } from './types';
import { IRootConfig } from '@microlambda/config';
import {deploySharedInfraStack, removeSharedInfraStack} from './stack-deployer';
import { IEnvironment, State } from '@microlambda/remote-state';
import { IBaseLogger } from '@microlambda/types';
import {Project} from "../graph/project";
import {Workspace} from "../graph/workspace";

const _applySharedInfrastructure = async (

params: {  action: 'deploy' | 'remove',
  project: Project,
  config: IRootConfig,
  env: IEnvironment,
  concurrency: number,
  verbose: boolean,
  force: boolean,
  currentRevision: string,},
  logger?: IBaseLogger,
): Promise<Observable<SharedInfraDeployEvent>> => {
  const {action, env, concurrency, project, config, verbose, force, currentRevision } = params;
  return new Observable<SharedInfraDeployEvent>((obs) => {
    const sharedInfraWorkspaces: Workspace[] = [];
    for (const workspace of project.workspaces.values()) {
      if (workspace.hasCommand('infra:deploy') && workspace.hasCommand('infra:remove')) {
        sharedInfraWorkspaces.push();
      }
    }
    logger?.debug('Deploying shared infrastructure');
    logger?.debug('Stacks', sharedInfraWorkspaces.map(w => w.name));
    const state = new State(config);
    obs.next({
      type: SharedInfraDeployEventType.WORKSPACES_RESOLVED,
      workspaces: sharedInfraWorkspaces,
    });
    const deployments$ = sharedInfraWorkspaces.map((workspace) =>
      action === 'deploy' ? deploySharedInfraStack({
        env,
        workspace,
        state,
        config,
        verbose,
        force,
        project,
        concurrency,
        currentRevision,
      }) : removeSharedInfraStack({
        env,
        workspace,
        state,
        config,
        verbose,
        project,
        concurrency,
        currentRevision,
      }));
    logger?.debug('Prepared', deployments$.length, 'deploy/remove operations');
    from(deployments$)
      .pipe(mergeAll())
      .subscribe({
        next: (evt) => obs.next(evt),
        error: (err) => obs.error(err),
        complete: () => obs.complete(),
      });
  });
};

export const deploySharedInfrastructure = async (
  params: {
    project: Project,
    config: IRootConfig,
    env: IEnvironment,
    concurrency: number,
    verbose: boolean,
    force: boolean,
    currentRevision: string,},
  logger?: IBaseLogger,
): Promise<Observable<SharedInfraDeployEvent>> => {
  return _applySharedInfrastructure({action: 'deploy', ...params}, logger);
};

export const removeSharedInfrastructure = async (
  params: {
    project: Project,
    config: IRootConfig,
    env: IEnvironment,
    concurrency: number,
    verbose: boolean,
    currentRevision: string,},
  logger?: IBaseLogger,
): Promise<Observable<SharedInfraDeployEvent>> => {
  return _applySharedInfrastructure({action: 'remove', ...params, force: true}, logger);
}
