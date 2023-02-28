import { EnvironmentLoader } from '@microlambda/environments';
import { Workspace } from '@microlambda/runner-core';
import { IBaseLogger } from '@microlambda/types';

export const injectLocalEnvironmentVariables = async (workspace: Workspace, logger?: IBaseLogger) => {
  if (!workspace.project) {
    throw new Error("Assertion failed: project not resolved");
  }
  const environmentLoader = new EnvironmentLoader(workspace.project, logger);
  const global = await environmentLoader.loadGlobal('local');
  const service = await environmentLoader.loadServiceScoped('local', workspace);
  for (const variable of [...global, ...service]) {
    process.env[variable.key] = variable.value;
  }
}
