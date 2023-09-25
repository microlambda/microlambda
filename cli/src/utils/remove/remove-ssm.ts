import { EnvironmentLoader } from '@microlambda/environments';
import { logger } from '../logger';
import { IEnvironment } from '@microlambda/remote-state';
import { Project } from '@microlambda/core';

export const removeSsmAndSecrets = async (
  env: IEnvironment,
  project: Project,
  releaseLock: (msg?: string) => Promise<void>,
): Promise<void> => {
  const loader = new EnvironmentLoader(project);
  let hasFailed = false;
  for (const region of env.regions) {
    const { failures } = await loader.destroyRegionalReplicate(env.name, region);
    failures.forEach((err, envVar) => {
      logger.error(`Failed to destroy secret/ssm parameter ${envVar.raw} in region ${region}`);
      logger.error('Original error:', err);
    });
    if (failures.size) {
      hasFailed = true;
    }
  }

  if (hasFailed) {
    await releaseLock();
    process.exit(1);
  }
};
