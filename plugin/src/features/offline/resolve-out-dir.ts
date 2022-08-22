import { Workspace } from "@microlambda/core";
import { IBaseLogger } from "@microlambda/types";
import { getTsConfig } from '@microlambda/utils';

export const resolveOutDir = (service: Workspace, logger?: IBaseLogger): string => {
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
