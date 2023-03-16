import {EnvironmentLoader, SSMResolverMode} from '@microlambda/environments';
import { Project, Workspace } from '@microlambda/runner-core';
import { IBaseLogger, ServerlessInstance } from '@microlambda/types';
import chalk from 'chalk';

export const injectLambdasEnvironmentVariables = async (
  serverless: ServerlessInstance,
  workspace?: Workspace,
  ssmMode = SSMResolverMode.ERROR,
  logger?: IBaseLogger,
): Promise<void> => {
  if (!workspace) {
    throw new Error("Assertion failed: service not resolved");
  }
  if (!workspace.project) {
    throw new Error("Assertion failed: service not resolved");
  }
  const stage = serverless.service.provider.stage;
  const environmentLoader = new EnvironmentLoader(workspace.project, logger);
  logger?.info('[env] Loading environment for stage', stage);
  const global = await environmentLoader.loadGlobal(stage, ssmMode);
  const service = await environmentLoader.loadServiceScoped(stage, workspace, ssmMode);
  if (!serverless.service.provider.environment) {
    serverless.service.provider.environment = {};
  }
  for (const variable of [...global, ...service]) {
    logger?.info(`- ${variable.key}=${variable.value} ${chalk.grey('(' + variable.from + ')')}`);
    if (variable.value) {
      serverless.service.provider.environment[variable.key] = variable.value;
    }
  }
}
