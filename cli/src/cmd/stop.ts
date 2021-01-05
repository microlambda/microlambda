import { RecompilationScheduler, getProjectRoot, IPCSocketsManager, Logger } from '@microlambda/core';

export const stop = async (scheduler: RecompilationScheduler, logger: Logger, service?: string): Promise<void> => {
  // TODO: Display UI with services, stop them an exit 0.
  const projectRoot = getProjectRoot(logger);
  const sockets = new IPCSocketsManager(projectRoot, scheduler, logger);
  await sockets.requestStop(service).catch(() => process.exit(1));
  process.exit(0);
};
