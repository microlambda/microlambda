import { IEnvironment, State } from '@microlambda/remote-state';
import { command } from 'execa';
import { concatAll, from, Observable, of } from 'rxjs';
import { SharedInfraDeployEvent, SharedInfraDeployEventType } from './types';
import { dirname, join } from 'path';
import { fromFileSync as hasha } from 'hasha';
import { IBaseLogger } from '@microlambda/types';

const runSlsCommand = (
  params: {
    yml: string;
    env: string;
    action: 'deploy' | 'remove';
    region: string;
    state: State;
    checksum?: string;
    projectRoot: string;
  },
  logger?: IBaseLogger,
): Observable<SharedInfraDeployEvent> => {
  const { action, region, env, yml, state, checksum, projectRoot } = params;
  const yamlAbsolute = join(projectRoot, yml);

  return new Observable<SharedInfraDeployEvent>((obs) => {
    logger?.debug('starting evt', yml, env, region, action);
    obs.next({
      type: action === 'deploy' ? SharedInfraDeployEventType.DEPLOYING : SharedInfraDeployEventType.REMOVING,
      region,
      env: env,
      stack: yml,
    });
    logger?.debug('Running cmd', `npx sls ${action}`, {
      env: { ENV: env, AWS_REGION: region },
      cwd: dirname(yamlAbsolute),
    });
    command(`npx sls ${action}`, { env: { ENV: env, AWS_REGION: region }, cwd: dirname(yamlAbsolute) })
      .then((result) => {
        logger?.debug('command succeed', yml, env, region, action);
        if (action === 'deploy') {
          state.setSharedInfrastructureState({ yml, region, checksum: checksum ?? '' }).finally(() => {
            obs.next({
              type: SharedInfraDeployEventType.DEPLOYED,
              region,
              env: env,
              stack: yml,
              result,
            });
          });
        } else {
          state.deleteSharedInfrastructureState(yml, region).finally(() => {
            obs.next({
              type: SharedInfraDeployEventType.REMOVED,
              region,
              env: env,
              stack: yml,
              result,
            });
          });
        }
      })
      .catch((err) => {
        logger?.debug('cmf failed', yml, env, region, action);
        obs.next({
          type:
            action === 'deploy' ? SharedInfraDeployEventType.FAILED_DEPLOY : SharedInfraDeployEventType.FAILED_REMOVE,
          region,
          env: env,
          stack: yml,
          err,
        });
      })
      .finally(() => obs.complete());
  });
};

/**
 * Deploy a shared infrastructure stack using sls deploy command in each region
 * the environment is replicated on.
 * ENV and AWS_REGION are automatically populated.
 * @param env - target stage
 * @param projectRoot
 * @param yml - target serverless.yml absolute path
 * @param state
 * @param logger
 */
export const deploySharedInfraStack = (
  env: IEnvironment,
  projectRoot: string,
  yml: string,
  state: State,
  logger?: IBaseLogger,
): Observable<SharedInfraDeployEvent> => {
  logger?.debug('Preparing update for stack', yml, env.name);
  return new Observable<SharedInfraDeployEvent>((obs) => {
    const yamlAbsolute = join(projectRoot, yml);
    state
      .getSharedInfrastructureState(yml)
      .then((sharedInfraState) => {
        logger?.debug(sharedInfraState);
        const regionalDeployment$: Array<Observable<SharedInfraDeployEvent>> = [];
        for (const region of env.regions) {
          logger?.debug('Resolving operations for', yml, env.name, region);
          const currentState = sharedInfraState.find((s) => s.region === region);
          logger?.debug({ currentState });
          let shouldDeploy = true;
          const currentChecksum = hasha(yamlAbsolute);
          logger?.debug({ currentChecksum });
          if (currentState) {
            const storedChecksum = currentState.checksum;
            shouldDeploy = currentChecksum !== storedChecksum;
            logger?.debug({ storedChecksum });
          } else {
            logger?.debug('No current state');
          }
          logger?.debug({ shouldDeploy });
          if (shouldDeploy) {
            regionalDeployment$.push(
              runSlsCommand(
                { yml, env: env.name, region, action: 'deploy', state, checksum: currentChecksum, projectRoot },
                logger,
              ),
            );
          } else {
            logger?.debug('No change evt', {
              type: SharedInfraDeployEventType.NO_CHANGES,
              region,
              env: env.name,
              stack: yml,
            });
            regionalDeployment$.push(
              of({
                type: SharedInfraDeployEventType.NO_CHANGES,
                region,
                env: env.name,
                stack: yml,
              }),
            );
          }
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
              runSlsCommand({ yml, env: env.name, region, action: 'remove', state, projectRoot }, logger),
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
  env: IEnvironment,
  projectRoot: string,
  yml: string,
  state: State,
  logger?: IBaseLogger,
): Observable<SharedInfraDeployEvent> => {
  logger?.debug('Preparing update for stack', yml, env.name);
  const regionalDeployment$: Array<Observable<SharedInfraDeployEvent>> = [];
  for (const region of env.regions) {
    regionalDeployment$.push(
      runSlsCommand(
        { yml, env: env.name, region, action: 'remove', state, projectRoot },
        logger,
      ),
    );
  }
  return from(regionalDeployment$).pipe(concatAll())
};
