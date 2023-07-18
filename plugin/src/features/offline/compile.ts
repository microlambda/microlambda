import { Workspace } from '@microlambda/core';
import { IBaseLogger } from '@microlambda/types';

export const transpile = async (
  service: Workspace,
  logger?: IBaseLogger,
): Promise<void> => {
  const now = Date.now();
  await service.transpile();
  const took = Date.now() - now;
  logger?.info(`${service.name} transpiled in ${took}ms`);
};
