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
import { actions, doRender } from '../ui';

interface IStartOptions {
  interactive: boolean;
  recompile: boolean;
  defaultPort: number;
}

export const start = async (scheduler: RecompilationScheduler, options: IStartOptions): Promise<void> => {
  log('start').info('Starting up the app');
  const projectRoot = getProjectRoot();
  log('start').debug('Loading config');
  const config = loadConfig();
  await verifyBinaries(config.compilationMode, projectRoot);
  scheduler.setMode(config.compilationMode);
  log('start').debug(config);
  log('start').info('Parsing lerna dependency graph', projectRoot);
  doRender();
  actions.parsingGraph();
  const graph = await getLernaGraph(projectRoot, config, options.defaultPort);
  scheduler.setGraph(graph);
  actions.graphParsed();
  actions.setGraph(graph);
  const sockets = new SocketsManager(projectRoot, scheduler, graph);
  await sockets.createServer();
  graph.registerIPCServer(sockets);
  await graph.bootstrap().catch((e) => {
    const message =
      'Error installing microservices dependencies. Run in verbose mode (export MILA_DEBUG=*) for more infos.';
    log('start').error(e);
    log('start').error(message);
    actions.lernaErrored();
    // eslint-disable-next-line no-console
    console.error(message);
    process.exit(1);
  });
  actions.graphBootstrapped();
  log('start').debug('Services excluded by config', config.noStart);
  const enabledServices = graph.getServices().filter((s) => !config.noStart.includes(s.getName()));
  log('start').debug(
    'Enabled services',
    enabledServices.map((s) => s.getName()),
  );

  let chosenServices: Service[] = [];

  // TODO: Implement my own service selector in react
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

  // TODO: Create a file events.log at .mila root for these logs
  // TODO: Also persist them in memory to be shown with (l) command
  log('start').debug(
    'Enabled nodes',
    graph
      .getNodes()
      .filter((n) => n.isEnabled())
      .map((n) => n.getName()),
  );

  // TODO: Also create a in-memory map to persist services logs
  recreateLogDirectory(projectRoot);

  log('start').info(`Found ${chosenServices.length} services`);
  log('start').info('Starting services');
  log('start').debug(chosenServices);
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
