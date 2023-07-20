import { IRootConfig } from '@microlambda/config';
import { sync } from 'glob';
import { basename } from 'path';

/**
 * Returns all serverless.yml path (relative to project root) of shared infrastructure stack to apply before
 * deploying microservices, by resolving globs array in root config.
 * @param config
 * @param projectRoot
 */
export const resolveSharedInfrastructureYamls = (config: IRootConfig, projectRoot: string): string[] => {
  const yamls: string[] = [];
  if (config.sharedResources?.length) {
    for (const pattern of Array.isArray(config.sharedResources) ? config.sharedResources : [config.sharedResources]) {
      const path = sync(pattern, { cwd: projectRoot });
      yamls.push(...path.filter((p) => basename(p).match(/serverless\.ya?ml$/)));
    }
  }
  return yamls;
};
