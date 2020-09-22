import { getProjectRoot } from '../utils/get-project-root';
import { IPCSocketsManager } from '../ipc/socket';
import { RecompilationScheduler } from '../utils/scheduler';
import { Logger } from '../utils/logger';

export const status = (scheduler: RecompilationScheduler, logger: Logger): void => {
  // TODO: Subscribe status from IPC socket and use same UI than start
  const projectRoot = getProjectRoot(logger);
  const sockets = new IPCSocketsManager(projectRoot, scheduler, logger);
  sockets.subscribeStatus().subscribe((status) => {
    logger.log('cmd').info(status);
  });
};
