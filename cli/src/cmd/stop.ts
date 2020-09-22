import { RecompilationScheduler } from '../utils/scheduler';
import { getProjectRoot } from '../utils/get-project-root';
import { IPCSocketsManager } from '../ipc/socket';
import { Logger } from '../utils/logger';

export const stop = async (scheduler: RecompilationScheduler, logger: Logger, service?: string): Promise<void> => {
  // TODO: Display UI with services, stop them an exit 0.
  const projectRoot = getProjectRoot(logger);
  const sockets = new IPCSocketsManager(projectRoot, scheduler, logger);
  await sockets.requestStop(service).catch(() => process.exit(1));
  process.exit(0);
};
