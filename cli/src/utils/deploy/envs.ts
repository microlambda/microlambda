import { resolveEnvs } from '@microlambda/core';
import { SSMResolverMode } from '@microlambda/environments';
import { Project } from '@microlambda/core';
import { IBaseLogger } from '@microlambda/types';

export class EnvsResolver {
  constructor(readonly project: Project, readonly env: string, private readonly _logger?: IBaseLogger) {}
  private readonly _envs: Map<string, Map<string, Record<string, string>>> = new Map();

  async resolve(region: string, mode = SSMResolverMode.ERROR): Promise<Map<string, Record<string, string>>> {
    const alreadyResolved = this._envs.get(region);
    if (alreadyResolved) {
      return alreadyResolved;
    }
    const env = await resolveEnvs(this.project, this.env, mode, region, this._logger);
    for (const e of env.values()) {
      e.AWS_REGION = region;
    }
    this._envs.set(region, env);
    return env;
  }
}
