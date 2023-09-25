import { from, mergeAll, Observable, of } from 'rxjs';
import { SharedInfraDeployEvent, SharedInfraDeployEventType } from './types';
import { resolveSharedInfrastructureYamls } from './resolve-path';
import { IRootConfig } from '@microlambda/config';
import {deploySharedInfraStack, removeSharedInfraStack} from './stack-deployer';
import { IEnvironment, State } from '@microlambda/remote-state';
import { IBaseLogger } from '@microlambda/types';

const _applySharedInfrastructure = async (
  action: 'deploy' | 'remove',
  projectRoot: string,
  config: IRootConfig,
  env: IEnvironment,
  concurrency?: number,
  logger?: IBaseLogger,
): Promise<Observable<SharedInfraDeployEvent>> => {
  return new Observable<SharedInfraDeployEvent>((obs) => {
    const stacks = resolveSharedInfrastructureYamls(config, projectRoot);
    logger?.debug('Deploying shared infrastructure');
    logger?.debug('Stacks', stacks);
    const state = new State(config);
    obs.next({
      type: SharedInfraDeployEventType.STACKS_RESOLVED,
      stacks,
    });
    const deployments$ = stacks.map((stack) =>
      action === 'deploy' ? deploySharedInfraStack(env, projectRoot, stack, state, logger) : removeSharedInfraStack(env, projectRoot, stack, state, logger))
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
  projectRoot: string,
  config: IRootConfig,
  env: IEnvironment,
  concurrency?: number,
  logger?: IBaseLogger,
): Promise<Observable<SharedInfraDeployEvent>> => {
  return _applySharedInfrastructure('deploy', projectRoot, config, env, concurrency, logger);
};

export const removeSharedInfrastructure = async (
  projectRoot: string,
  config: IRootConfig,
  env: IEnvironment,
  concurrency?: number,
  logger?: IBaseLogger,
): Promise<Observable<SharedInfraDeployEvent>> => {
  return _applySharedInfrastructure('remove', projectRoot, config, env, concurrency, logger);
}
