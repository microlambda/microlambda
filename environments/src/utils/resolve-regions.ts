import { IRootConfig } from '@microlambda/config';
import { State } from '@microlambda/remote-state';

export const resolveTargetsRegions = async (config: IRootConfig, env?: string): Promise<Array<string>> => {
  const state = new State(config.state.table, config.defaultRegion);
  if (env) {
    const stage = await state.findEnv(env);
    return stage.regions;
  }
  const envs = await state.listEnvironments();
  const allRegions = envs.reduce((acc, current) => acc.concat(current.regions), [] as string[]);
  return [...new Set(allRegions)];
};
