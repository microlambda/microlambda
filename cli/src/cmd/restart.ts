import { RecompilationScheduler } from '../utils/scheduler';
import { getProjectRoot } from '../utils/get-project-root';
import { IPCSocketsManager } from '../ipc/socket';
import { Logger } from '../utils/logger';

export const restart = async (scheduler: RecompilationScheduler, logger: Logger, service?: string): Promise<void> => {
  // TODO: UI Just inform that service has restarted/failed
  logger.log('cmd').debug('Restart service', service);
  const projectRoot = getProjectRoot(logger);
  const sockets = new IPCSocketsManager(projectRoot, scheduler, logger);
  await sockets.requestRestart(service).catch(() => process.exit(1));
  process.exit(0);
};
