import { Workspace } from "@microlambda/core";
import { ILogger } from "../../types";

export const transpile = async (
  service: Workspace,
  logger?: ILogger
): Promise<void> => {
  const now = Date.now();
  await service.transpile();
  const took = Date.now() - now;
  logger?.info(`${service.name} transpiled in ${took}ms`);
};
