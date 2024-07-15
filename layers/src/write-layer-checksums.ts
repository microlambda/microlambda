import { aws } from '@microlambda/aws';
import { IBaseLogger } from '@microlambda/types';
import { IStateConfig } from '@microlambda/config';
import { ISourcesChecksums, Workspace } from '@microlambda/runner-core';
import { calculateLayerChecksums } from './calculate-layer-checksums';
import { State } from '@microlambda/remote-state';

export const writeLayerChecksums = async (
  service: Workspace,
  env: string,
  config: IStateConfig,
  _checksums?: ISourcesChecksums,
  logger?: IBaseLogger,
): Promise<void> => {
  try {
    const key = `caches/${service.name}/layers/${env}/checksums.json`;
    const checksums = _checksums || (await calculateLayerChecksums(service));
    logger?.info(
      '[package] Writing current layer checksums at',
      `s3://${config.state.checksums}/${key} (${config.defaultRegion})`,
    );
    const state = new State(config.state.table, config.defaultRegion);
    await aws.s3.putObject(config.defaultRegion, key, JSON.stringify(checksums), config.defaultRegion);
    await state.setLayerChecksums({
      env,
      service: service.name,
      checksums_buckets: config.state.checksums,
      checksums_key: key,
      region: config.defaultRegion,
    });
    logger?.info('[package] Current layer checksums written');
  } catch (e) {
    logger?.warn(
      '[package] Cannot write layers checksums. Next time layers will be refreshed event if dependencies set did not change',
      e,
    );
  }
};
