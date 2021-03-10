import joi from "joi";
import { domainConfig } from "./domain";
import { replaceAuthorizerConfig } from "./authorizer-replace";
import { secretsConfig } from "./secrets";

export const configSchema = joi.object().keys({
  domain: domainConfig.optional(),
  localAuthorizer: joi
    .alternatives(
      replaceAuthorizerConfig,
      joi.array().items(replaceAuthorizerConfig)
    )
    .optional(),
  secrets: secretsConfig.optional(),
});
