import { Workspace, Checksums, ISourcesChecksums } from '@microlambda/runner-core';
import { IRootConfig } from '@microlambda/config';
import { State } from '@microlambda/remote-state';
import { aws } from '@microlambda/aws';
import { calculateLayerChecksums } from './calculate-layer-checksums';
import { IBaseLogger } from '@microlambda/types';

export const shouldRecreateLayer = async (
  service: Workspace,
  env: string,
  config: IRootConfig,
  logger?: IBaseLogger,
): Promise<{ recreate: boolean; currentChecksums?: ISourcesChecksums }> => {
  try {
    const state = new State(config);
    const lastLayer = await state.getLastLayerChecksums(service.name, env);
    logger?.info('[package] Fetching last layer checksums');
    if (!lastLayer) {
      logger?.info('[package] Not checksums found');
      return { recreate: true };
    }
    const rawStoredChecksums = await aws.s3.downloadBuffer(
      lastLayer.checksums_buckets,
      lastLayer.checksums_key,
      lastLayer.region,
    );
    const storedChecksums = rawStoredChecksums ? JSON.parse(rawStoredChecksums?.toString('utf-8')) : {};
    logger?.info('[package] Last layer checksums found');
    logger?.debug('[package] Stored checksums', storedChecksums);
    logger?.info('[package] Computing ');
    logger?.info('[package] Computing current layer checksums');
    const currentChecksums = await calculateLayerChecksums(service);
    const hasChanged = !Checksums.compare(currentChecksums, storedChecksums);
    logger?.info('[package] Current layer checksums computed. Has changed', hasChanged);

    return { recreate: hasChanged, currentChecksums };
  } catch (e) {
    logger?.info('[package] Last layer checksums could not be determine, layer will be re-deployed');
    return { recreate: true };
  }
};
