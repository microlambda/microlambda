import { RecompilationScheduler } from '../utils/scheduler';
import { getProjectRoot } from '../utils/get-project-root';
import { SocketsManager } from '../ipc/socket';

export const stop = async (scheduler: RecompilationScheduler, service?: string): Promise<void> => {
  // TODO: Display UI with services, stop them an exit 0.
  const projectRoot = getProjectRoot();
  const sockets = new SocketsManager(projectRoot, scheduler);
  await sockets.requestStop(service).catch(() => process.exit(1));
  process.exit(0);
};
