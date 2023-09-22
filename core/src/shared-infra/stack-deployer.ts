import {IEnvironment, State} from '@microlambda/remote-state';
import { command } from 'execa';
import { concatAll, from, Observable } from 'rxjs';
import { SharedInfraDeployEvent, SharedInfraDeployEventType } from './types';
import { dirname } from 'path';
import { fromFileSync as hasha} from "hasha";

/**
 * Deploy a shared infrastructure stack using sls deploy command in each region
 * the environment is replicated on.
 * ENV and AWS_REGION are automatically populated.
 * @param env - target stage
 * @param yml - target serverless.yml absolute path
 */
export const deploySharedInfraStack = (env: IEnvironment, yml: string, state: State): Observable<SharedInfraDeployEvent> => {
  const regionalDeployment$: Array<Observable<SharedInfraDeployEvent>> = [];
  state.getSharedInfrastructureState(yml).then((sharedInfraState) => {
    for (const region of env.regions) {
      const currentState = sharedInfraState.find((s) => s.region = region);
      let shouldDeploy = true;
      if (currentState) {
        const currentChecksum = hasha(yml);
        const storedChecksum = currentState.checksum;
        shouldDeploy = currentChecksum !== storedChecksum;
      }

      regionalDeployment$.push(
        new Observable<SharedInfraDeployEvent>((obs) => {
          obs.next({
            type: SharedInfraDeployEventType.DEPLOING,
            region,
            env: env.name,
            stack: yml,
          });
          command('npx sls deploy', { env: { ENV: env.name, AWS_REGION: region }, cwd: dirname(yml) })
            .then((result) => {
              obs.next({
                type: SharedInfraDeployEventType.SUCCEEDED,
                region,
                env: env.name,
                stack: yml,
                result,
              });
            })
            .catch((err) => {
              obs.next({
                type: SharedInfraDeployEventType.FAILED,
                region,
                env: env.name,
                stack: yml,
                err,
              });
            })
            .finally(() => obs.complete());
        }),
      );
    }
    return from(regionalDeployment$).pipe(concatAll());
  });
};

