import {
  IBaseLogger,
  ServerlessInstance,
  ILocalAuthorizerConfig,
  IPluginConfig,
} from '@microlambda/types';
import { areAuthorizersMatching } from './matching-authorizers';

export const replaceAuthorizer = (
  serverless: ServerlessInstance,
  config: IPluginConfig | undefined,
  logger?: IBaseLogger,
): void => {
  const swaps =
    config && config.localAuthorizer
      ? Array.isArray(config.localAuthorizer)
        ? config.localAuthorizer
        : [config.localAuthorizer]
      : [];
  if (!swaps.length) {
    logger?.debug('Not authorizer replacements configured');
    return;
  }
  const functions = serverless.service
    .getAllFunctions()
    .map((name) => serverless.service.functions[name]);

  const swapAuthorizer = (
    swap: ILocalAuthorizerConfig,
    apiType: 'http' | 'websocket',
  ): void => {
    logger?.debug('Replacing', apiType, 'authorizers', swap);
    const eligibleFunctions = functions.filter((f) =>
      f.events.some((e) =>
        areAuthorizersMatching(e[apiType]?.authorizer, swap.replace),
      ),
    );
    logger?.debug(
      'Found matching functions',
      apiType,
      eligibleFunctions.map((f) => f.name),
    );
    for (const toPatch of eligibleFunctions) {
      const evt = toPatch.events.find((e) =>
        areAuthorizersMatching(e[apiType]?.authorizer, swap.replace),
      );
      if (!evt) {
        throw new Error(
          'Assertion failed: event to patch should have been found',
        );
      }
      const evtConfig = evt[apiType];
      if (!evtConfig) {
        throw new Error(
          `Assertion failed: event to patch have ${apiType} property`,
        );
      }
      evtConfig.authorizer = swap.with;
    }
  };

  for (const swap of swaps) {
    swapAuthorizer(swap, 'http');
    swapAuthorizer(swap, 'websocket');
    if (swap.replace.remove && swap.replace.name) {
      logger?.info('Removing local authorizer', swap.replace.name);
      delete serverless.service.functions[swap.replace.name];
    }
  }
  logger?.info('All local authorizers successfully replaced');
};
