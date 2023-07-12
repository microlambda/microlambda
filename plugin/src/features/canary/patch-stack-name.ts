import {State} from "@microlambda/remote-state";
import {IRootConfig} from "@microlambda/config";
import {IBaseLogger, ServerlessInstance} from "@microlambda/types";

export const patchServiceName = async (serverless: ServerlessInstance, config: IRootConfig | undefined, env: string, logger: IBaseLogger): Promise<void> => {
  if (!config) {
    logger.error('Assertion failed: unresolved config');
    throw new Error('Assertion failed: unresolved config');
  }
  const state = new State(config);
  const _env = await state.findEnv(env);
  if (_env.useCanary && _env.currentVersion) {
    logger.info(`Notice: this service uses canary release`);
    logger.info('The current version for this service is', _env.currentVersion);
    const updatedStackName = serverless.service + '-v' + _env.currentVersion;
    logger.info('Deploying stack', updatedStackName);
    serverless.service = updatedStackName;
  }
}
