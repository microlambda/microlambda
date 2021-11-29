import { getTsConfig, Workspace } from "@microlambda/core";
import { ILogger } from "../../types";

export const resolveOutDir = (service: Workspace, logger?: ILogger): string => {
  let outDir: string | undefined;
  const message = `Error: cannot resolve typescript outDir`;
  try {
    outDir = getTsConfig(service.root).options.outDir;
  } catch (e) {
    logger?.error(message);
    logger?.error(e);
    throw new Error(message);
  }
  logger?.info(`Transpiling ${service.name} to ${outDir}`);
  if (!outDir) {
    logger?.error(message);
    throw new Error(message);
  }
  return outDir;
};
