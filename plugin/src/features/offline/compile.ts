import { Service } from "@microlambda/core";
import { ILogger } from "../../types";

export const transpile = async (
  service: Service,
  logger?: ILogger
): Promise<void> => {
  const now = Date.now();
  await service.transpile().toPromise();
  const took = Date.now() - now;
  logger?.info(`${service.getName()} transpiled in ${took}ms`);
};
