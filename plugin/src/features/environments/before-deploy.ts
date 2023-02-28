import { EnvironmentLoader } from '@microlambda/environments';
import { Project, Workspace } from '@microlambda/runner-core';
import { IBaseLogger, ServerlessInstance } from '@microlambda/types';
import chalk from 'chalk';

export const injectLambdasEnvironmentVariables = async (
  serverless: ServerlessInstance,
  workspace?: Workspace,
  logger?: IBaseLogger,
) => {
  if (!workspace) {
    throw new Error("Assertion failed: service not resolved");
  }
  if (!workspace.project) {
    throw new Error("Assertion failed: service not resolved");
  }
  const stage = serverless.service.provider.stage;
  const environmentLoader = new EnvironmentLoader(workspace.project, logger);
  const global = await environmentLoader.loadGlobal(stage);
  const service = await environmentLoader.loadServiceScoped(stage, workspace);
  for (const variable of [...global, ...service]) {
    logger?.info(`- ${variable.key}=${variable.value} ${chalk.grey('(' + variable.from + ')')}`);
    serverless.service.provider.environment[variable.key] = variable.value;
  }
}
