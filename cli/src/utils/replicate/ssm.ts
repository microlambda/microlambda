import { EnvironmentLoader } from '@microlambda/environments';
import { logger } from '../logger';
import { Project } from '@microlambda/core';

export const destroyRegionalSsmReplicate = async (
  project: Project,
  env: string,
  region: string,
  releaseLock: (msg?: string) => Promise<void>,
): Promise<void> => {
  const loader = new EnvironmentLoader(project, region);
  const { failures } = await loader.destroyRegionalReplicate(env, region);
  failures.forEach((err, envVar) => {
    logger.error(`Failed to destroy secret/ssm parameter ${envVar.raw} in region ${region}`);
    logger.error('Original error:', err);
  });

  if (failures.size) {
    await releaseLock();
    process.exit(1);
  }
};

export const replicateSsmParameters = async (
  project: Project,
  env: string,
  region: string,
  releaseLock: (msg?: string) => Promise<void>,
): Promise<void> => {
  const loader = new EnvironmentLoader(project, region);
  const { failures } = await loader.createRegionalReplicate(env, region);
  failures.forEach((err, envVar) => {
    logger.error(`Failed to replicate secret/ssm parameter ${envVar.raw} in region ${region}`);
    logger.error('Original error:', err);
  });

  if (failures.size) {
    await releaseLock();
    process.exit(1);
  }
};
