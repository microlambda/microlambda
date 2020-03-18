import { RecompilationScheduler } from '../utils/scheduler';
import { getProjectRoot } from '../utils/get-project-root';
import { SocketsManager } from '../ipc/socket';

export const restart = async (scheduler: RecompilationScheduler, service?: string) => {
  const projectRoot = getProjectRoot();
  const sockets = new SocketsManager(projectRoot, scheduler);
  await sockets.requestRestart(service).catch(() => process.exit(1));
  process.exit(0);
};
