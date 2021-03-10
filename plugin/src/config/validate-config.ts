import { IPluginConfig } from "./types";
import { configSchema } from "./schemas";
import { ILogger } from "../types";

export const validateConfig = (
  config: unknown,
  logger?: ILogger
): IPluginConfig => {
  const { error, value } = configSchema.validate(config);
  if (error) {
    logger?.error("Invalid plugin configuration");
    logger?.error(error);
    throw error;
  }
  return value;
};
