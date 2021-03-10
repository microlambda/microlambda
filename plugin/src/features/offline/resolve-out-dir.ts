import { getTsConfig, Service } from "@microlambda/core";
import { ILogger } from "../../types";

export const resolveOutDir = (service: Service, logger?: ILogger): string => {
  let outDir: string | undefined;
  const message = `Error: cannot resolve typescript outDir`;
  try {
    outDir = getTsConfig(service.getLocation()).options.outDir;
  } catch (e) {
    logger?.error(message);
    logger?.error(e);
    throw new Error(message);
  }
  logger?.info(`Transpiling ${service.getName()} to ${outDir}`);
  if (!outDir) {
    logger?.error(message);
    throw new Error(message);
  }
  return outDir;
};
