import { EnvironmentLoader, SSMResolverMode } from '@microlambda/environments';
import { Workspace } from '@microlambda/runner-core';
import { IBaseLogger, ServerlessInstance } from '@microlambda/types';
import chalk from 'chalk';

export const injectLambdasEnvironmentVariables = async (
  hook: 'before-offline' | 'before-deploy',
  serverless: ServerlessInstance,
  workspace?: Workspace,
  logger?: IBaseLogger,
): Promise<void> => {
  if (!workspace) {
    throw new Error('Assertion failed: service not resolved');
  }
  if (!workspace.project) {
    throw new Error('Assertion failed: project not resolved');
  }
  const stage = serverless.service.provider.stage;
  const environmentLoader = new EnvironmentLoader(
    workspace.project,
    undefined,
    logger,
  );
  logger?.info('[env] Loading environment for stage', stage);
  const variables = await environmentLoader.loadAll({
    env: stage,
    service: workspace,
    shouldInterpolate: hook === 'before-offline',
    overwrite: false,
    inject: hook === 'before-offline',
    ssmMode:
      hook === 'before-offline'
        ? SSMResolverMode.IGNORE
        : SSMResolverMode.ERROR,
  });
  if (!serverless.service.provider.environment) {
    serverless.service.provider.environment = {};
  }
  for (const variable of variables) {
    logger?.info(
      `- ${variable.key}=${variable.value} ${chalk.grey(
        '(' + variable.from + ')',
      )}`,
    );
    if (variable.value) {
      serverless.service.provider.environment[variable.key] = variable.value;
    }
  }
};
