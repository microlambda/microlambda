import { showOff } from '../utils/ascii';
import { getProjectRoot } from '../utils/get-project-root';
import { loadConfig } from '../config/load-config';
import { getLernaGraph } from '../utils/get-lerna-graph';
import { log } from '../utils/logger';
import { interactive } from '../utils/interactive';

import { recreateLogDirectory } from '../utils/logs';
import { RecompilationScheduler } from '../utils/scheduler';
import { Service } from '../lerna';
import { SocketsManager } from '../ipc/socket';
import { verifyBinaries } from '../utils/external-binaries';
import { doRender, setGraph } from '../ui';

interface IStartOptions {
  interactive: boolean;
  recompile: boolean;
  defaultPort: number;
}

export const start = async (scheduler: RecompilationScheduler, options: IStartOptions): Promise<void> => {
  showOff();
  log('start').info('Starting up the app');
  const projectRoot = getProjectRoot();
  log('start').debug('Loading config');
  const config = loadConfig();
  await verifyBinaries(config.compilationMode, projectRoot);
  scheduler.setMode(config.compilationMode);
  log('start').debug(config);
  log('start').info('Parsing lerna dependency graph', projectRoot);
  const graph = await getLernaGraph(projectRoot, config, options.defaultPort);
  scheduler.setGraph(graph);
  const sockets = new SocketsManager(projectRoot, scheduler, graph);
  await sockets.createServer();
  graph.registerIPCServer(sockets);
  await graph.bootstrap().catch((e) => {
    log('start').error(e);
    log('start').error(
      'Error installing microservices dependencies. Run in verbose mode (export MILA_DEBUG=*) for more infos.',
    );
    process.exit(1);
  });

  log('start').debug('Services excluded by config', config.noStart);
  const enabledServices = graph.getServices().filter((s) => !config.noStart.includes(s.getName()));
  log('start').debug(
    'Enabled services',
    enabledServices.map((s) => s.getName()),
  );

  let chosenServices: Service[] = [];

  if (options.interactive) {
    await interactive(enabledServices, 'Please select the microservices you wants to start').then(
      (s) => (chosenServices = s),
    );
  } else {
    chosenServices = enabledServices;
  }
  log('start').debug(
    'Chosen services',
    chosenServices.map((s) => s.getName()),
  );
  chosenServices.forEach((s) => s.enable());
  graph.enableNodes();
  log('start').debug(
    'Enabled nodes',
    graph
      .getNodes()
      .filter((n) => n.isEnabled())
      .map((n) => n.getName()),
  );

  recreateLogDirectory(projectRoot);

  log('start').info(`Found ${chosenServices.length} services`);
  log('start').info('Starting services');
  log('start').debug(chosenServices);
  doRender();
  setGraph(graph);
  await scheduler.startProject(graph, options.recompile);

  graph
    .getNodes()
    .filter((n) => n.isEnabled())
    .forEach((n) => n.watch(scheduler));
  process.on('SIGINT', async () => {
    log('start').warn('SIGINT signal received');
    await scheduler.stopProject(graph);
    process.exit();
  });
};
