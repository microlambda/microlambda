import { RecompilationScheduler, getProjectRoot, IPCSocketsManager, Logger } from '@microlambda/core';

export const restart = async (scheduler: RecompilationScheduler, logger: Logger, service?: string): Promise<void> => {
  // TODO: UI Just inform that service has restarted/failed
  logger.log('cmd').debug('Restart service', service);
  const projectRoot = getProjectRoot(logger);
  const sockets = new IPCSocketsManager(projectRoot, scheduler, logger);
  await sockets.requestRestart(service).catch(() => process.exit(1));
  process.exit(0);
};
