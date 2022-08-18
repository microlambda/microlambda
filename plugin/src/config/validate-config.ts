import { configSchema } from "./schemas";
import { IBaseLogger, IPluginConfig } from "@microlambda/types";

export const validateConfig = (
  config: unknown,
  logger?: IBaseLogger
): IPluginConfig => {
  const { error, value } = configSchema.validate(config);
  if (error) {
    logger?.error("Invalid plugin configuration");
    logger?.error(error);
    throw error;
  }
  return value;
};
