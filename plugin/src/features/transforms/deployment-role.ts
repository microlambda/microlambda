import { ServerlessInstance } from '@microlambda/types';
import { IRootConfig } from '@microlambda/config';

export const updateDeploymentRole = (
  serverless: ServerlessInstance,
  config?: IRootConfig,
): void => {
  if (
    !serverless?.service?.provider?.iam?.deploymentRole &&
    config?.deploymentRole
  ) {
    serverless.service.provider.iam.deploymentRole = config.deploymentRole;
  }
};
