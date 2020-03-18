import { getProjectRoot } from '../utils/get-project-root';
import { SocketsManager } from '../ipc/socket';
import { log } from '../utils/logger';
import { RecompilationScheduler } from '../utils/scheduler';

export const status = async (scheduler: RecompilationScheduler) => {
  const projectRoot = getProjectRoot();
  const sockets = new SocketsManager(projectRoot, scheduler);
  await sockets.subscribeStatus().subscribe((status) => {
    log.info(status);
  });
};
