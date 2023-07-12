import {IPackageConfig, IRootConfig} from "@microlambda/config";
import {IBaseLogger, ServerlessInstance} from "@microlambda/types";

export const updateResourcesNames = (options: {
  env: string,
  serverless: ServerlessInstance,
  rootConfig: IRootConfig,
  serviceConfig: IPackageConfig,
  serviceName: string;
  currentVersion: number;
}, logger: IBaseLogger): void => {
  const { env, serviceName, serverless, rootConfig, serviceConfig } = options;
  const resolveNamePattern = (key: 'api' | 'stack' | 'iam' | 'handlers'): string | undefined => {
    if (serviceConfig.namingConventions && serviceConfig.namingConventions[key]) {
      return serviceConfig.namingConventions[key];
    }
    if (rootConfig.namingConventions && rootConfig.namingConventions[key]) {
      return rootConfig.namingConventions[key];
    }
    return undefined;
  }

  const interpolatePattern = (pattern: string): string => {
    return pattern
      .replace('$env', env)
      .replace('$service', serviceName)
      .replace('$version', options.currentVersion.toString())
  }

  const interpolateForHandlers = (pattern: string, handlerName: string): string => {
    const handler = serverless.service.functions[handlerName].handler;
    const fileName = handler.match(/.+\/(.+)\.(.+)$/)[1];
    return interpolatePattern(pattern).replace('$handlerName', handlerName).replace('$fileName', fileName);
  }

  if (rootConfig.namingConventions || serviceConfig.namingConventions) {

    const patterns = {
      api: resolveNamePattern('api'),
      stack: resolveNamePattern('stack'),
      handlers: resolveNamePattern('handlers'),
      iam: resolveNamePattern('iam'),
    }

    if (!serverless.service.provider.stackName && patterns.stack) {
      serverless.service.provider.stackName = interpolatePattern(patterns.stack);
      logger.info('Naming conventions - Replacing stack name:', interpolatePattern(patterns.stack));
    }

    if (!serverless.service.provider.apiName && patterns.api) {
      serverless.service.provider.apiName = interpolatePattern(patterns.api);
      logger.info('Naming conventions - Replacing API Gateway name:', interpolatePattern(patterns.api));
    }

    if (!serverless.service.provider.iam.role.name && patterns.iam) {
      serverless.service.provider.iam.role.name = interpolatePattern(patterns.iam);
      logger.info('Naming conventions - Replacing Lambda IAM Role name:', interpolatePattern(patterns.iam));
    }

    Object.keys(serverless.service.functions).forEach((handlerName) => {
      if (!serverless.service.functions[handlerName].name && patterns.handlers) {
        serverless.service.functions[handlerName].name = interpolateForHandlers(patterns.handlers, handlerName);
        logger.info('Naming conventions - Replacing Lambda function name:', interpolateForHandlers(patterns.handlers, handlerName));
      }
    })
  }
}
