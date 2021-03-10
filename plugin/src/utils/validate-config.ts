import joi from "joi";
import { IPluginConfig } from "../config";
import { IPluginLogger } from "./logger";

const authorizerConfigCommon = joi.object().keys({
  resultTtlInSeconds: joi.number().optional(),
  identitySource: joi.string().optional(),
  identityValidationExpression: joi.string().optional(),
  type: joi.string().valid("token", "request").optional(),
  remove: joi.boolean().optional(),
});

const authorizerConfig = joi.alternatives(
  authorizerConfigCommon.keys({
    name: joi.string().required(),
  }),
  authorizerConfigCommon.keys({
    arn: joi.string().required(),
  })
);

const replaceAuthorizerConfig = joi.object().keys({
  replace: authorizerConfig.required(),
  with: authorizerConfig.required(),
});

export const validateConfig = (
  config: unknown,
  logger?: IPluginLogger
): IPluginConfig => {
  const schema = joi
    .object()
    .keys({
      localAuthorizer: joi.alternatives(
        joi.array().items(replaceAuthorizerConfig),
        replaceAuthorizerConfig
      ),
      secrets: joi
        .array()
        .items(
          joi.object().keys({
            name: joi.string().required(),
            value: joi.string().required(),
            description: joi.string().optional(),
            kmsKeyId: joi.string().optional(),
          })
        )
        .optional(),
    })
    .unknown(true);
  const { error, value } = schema.validate(config);
  if (error) {
    logger?.error("Invalid plugin configuration");
    logger?.error(error);
    throw error;
  }
  return value;
};
