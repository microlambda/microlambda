import { getProjectRoot } from '../utils/get-project-root';
import { SocketsManager } from '../ipc/socket';
import { log } from '../utils/logger';
import { RecompilationScheduler } from '../utils/scheduler';

export const status = (scheduler: RecompilationScheduler): void => {
  const projectRoot = getProjectRoot();
  const sockets = new SocketsManager(projectRoot, scheduler);
  sockets.subscribeStatus().subscribe((status) => {
    log('cmd').info(status);
  });
};
