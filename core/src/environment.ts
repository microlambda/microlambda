import {EnvironmentLoader, SSMResolverMode} from "@microlambda/environments";
import {Project} from "./graph/project";
import {IBaseLogger} from "@microlambda/types";

export const resolveEnvs = async (
  project: Project,
  env: string,
  ssmMode = SSMResolverMode.ERROR,
  logger?: IBaseLogger,
): Promise<Map<string, Record<string, string>>> => {
  const envs = new Map<string, Record<string, string>>();
  const loader = new EnvironmentLoader(project, logger);
  const loadEnv$ = [...project.services.values()].map((service) => loader.loadAll({
    env,
    service,
    shouldInterpolate: true,
    overwrite: false,
    ssmMode,
    inject: false,
  }).then((loadedEnv) => {
    const vars: Record<string, string> = {};
    for (const entry of loadedEnv) {
      if (entry.value) {
        vars[entry.key] = entry.value;
      }
    }
    envs.set(service.name, vars);
  }));
  await Promise.all(loadEnv$);
  return envs;
}
