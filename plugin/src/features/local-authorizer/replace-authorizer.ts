import { ILogger, ServerlessInstance } from "../../types";
import { areAuthorizersMatching } from "./matching-authorizers";
import { IPluginConfig } from "../../config";

export const replaceAuthorizer = (
  serverless: ServerlessInstance,
  config: IPluginConfig | undefined,
  logger?: ILogger
): void => {
  const swaps =
    config && config.localAuthorizer
      ? Array.isArray(config.localAuthorizer)
        ? config.localAuthorizer
        : [config.localAuthorizer]
      : [];
  if (!swaps.length) {
    logger?.debug("Not authorizer replacements configured");
    return;
  }
  const functions = serverless.service
    .getAllFunctions()
    .map((name) => serverless.service.functions[name]);
  for (const swap of swaps) {
    logger?.debug("Replacing authorizer", swap);
    const eligibleFunctions = functions.filter((f) =>
      f.events.some((e) =>
        areAuthorizersMatching(e.http?.authorizer, swap.replace)
      )
    );
    logger?.debug(
      "Found matching functions",
      eligibleFunctions.map((f) => f.name)
    );
    for (const toPatch of eligibleFunctions) {
      const evt = toPatch.events.find((e) =>
        areAuthorizersMatching(e.http?.authorizer, swap.replace)
      );
      if (!evt || !evt.http) {
        throw new Error(
          "Assertion failed: event to patch should have been found"
        );
      }
      evt.http.authorizer = swap.with;
    }
    if (swap.replace.remove && swap.replace.name) {
      logger?.info("Removing local authorizer", swap.replace.name);
      delete serverless.service.functions[swap.replace.name];
    }
  }
  logger?.info("All local authorizers successfully replaced");
};
