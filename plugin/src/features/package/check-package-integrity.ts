import { LocalCache } from '@microlambda/runner-core/lib/cache/local-cache';
import { Workspace } from '@microlambda/runner-core';
import { LocalArtifacts } from '@microlambda/runner-core/lib/artifacts/local-artifacts';

export const checkPackageIntegrity = async (service: Workspace): Promise<boolean> => {
  const localCache = new LocalCache(service, 'package');
  const artifacts = new LocalArtifacts(service, 'package');
  const areArtifactsValid = await artifacts.checkArtifacts();
  const haveSourcesChanged = (await localCache.read()) == null;
  return areArtifactsValid && !haveSourcesChanged;
}
