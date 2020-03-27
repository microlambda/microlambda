import { getProjectRoot } from '../utils/get-project-root';
import { SocketsManager } from '../ipc/socket';
import { RecompilationScheduler } from '../utils/scheduler';

export const stop = async (scheduler: RecompilationScheduler, service?: string): Promise<void> => {
  const projectRoot = getProjectRoot();
  const sockets = new SocketsManager(projectRoot, scheduler);
  await sockets.requestStop(service).catch(() => process.exit(1));
  process.exit(0);
};
