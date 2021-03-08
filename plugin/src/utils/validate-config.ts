import joi from "joi";
import { IPluginConfig } from "../config";
import { IPluginLogger } from "./logger";

export const validateConfig = (
  config: unknown,
  logger?: IPluginLogger
): IPluginConfig => {
  const schema = joi
    .object()
    .keys({
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
