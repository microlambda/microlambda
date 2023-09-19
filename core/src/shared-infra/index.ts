import { from, mergeAll, Observable, of } from 'rxjs';
import { SharedInfraDeployEvent, SharedInfraDeployEventType } from './types';
import { resolveSharedInfrastructureYamls } from './resolve-path';
import { IRootConfig } from '@microlambda/config';
import { deploySharedInfraStack } from './stack-deployer';
import { IEnvironment } from '@microlambda/remote-state';
import { join } from 'path';
import { getDefaultThreads } from '@microlambda/utils';

export const deploySharedInfrastructure = (
  projectRoot: string,
  config: IRootConfig,
  env: IEnvironment,
  concurrency?: number,
): Observable<SharedInfraDeployEvent> => {
  const stacks = resolveSharedInfrastructureYamls(config, projectRoot);
  const stackDeployments$: Array<Observable<SharedInfraDeployEvent>> = [
    of({
      type: SharedInfraDeployEventType.STACKS_RESOLVED,
      stacks,
    }),
  ];
  for (const stack of stacks) {
    stackDeployments$.push(deploySharedInfraStack(env, join(projectRoot, stack)));
  }
  return from(stackDeployments$).pipe(mergeAll(concurrency ?? getDefaultThreads()));
};
