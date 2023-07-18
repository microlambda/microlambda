import { LocalCache } from '@microlambda/runner-core/lib/cache/local-cache';
import { Workspace } from '@microlambda/runner-core';
import { LocalArtifacts } from '@microlambda/runner-core/lib/artifacts/local-artifacts';
import { IBaseLogger } from '@microlambda/types';

export const checkPackageIntegrity = async (
  service: Workspace,
  logger?: IBaseLogger,
): Promise<boolean> => {
  const localCache = new LocalCache(service, 'package');
  const artifacts = new LocalArtifacts(service, 'package');
  const areArtifactsValid = await artifacts.checkArtifacts();
  const haveSourcesChanged = (await localCache.read()) == null;
  logger?.info('[package] have sources changed', haveSourcesChanged);
  logger?.info('[package] are artifacts valid', areArtifactsValid);
  return areArtifactsValid && !haveSourcesChanged;
};
