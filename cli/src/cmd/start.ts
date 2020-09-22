import { getProjectRoot } from '../utils/get-project-root';
import { loadConfig } from '../config/load-config';
import { getLernaGraph } from '../utils/get-lerna-graph';
import { interactive } from '../utils/interactive';
import { recreateLogDirectory } from '../utils/logs';
import { RecompilationScheduler } from '../utils/scheduler';
import { Service } from '../lerna';
import { IPCSocketsManager } from '../ipc/socket';
import { verifyBinaries } from '../utils/external-binaries';
import { actions } from '../ui';
import { execSync } from 'child_process';
import { startServer } from '../server';
import { IOSocketManager } from '../server/socket';
import { Logger } from '../utils/logger';
import { launch } from 'chrome-launcher';

interface IStartOptions {
  interactive: boolean;
  recompile: boolean;
  defaultPort: number;
}

export const start = async (
  scheduler: RecompilationScheduler,
  options: IStartOptions,
  logger: Logger,
): Promise<void> => {
  logger.log('start').info('Starting up the app');
  const projectRoot = getProjectRoot(logger);
  logger.log('start').debug('Loading config');
  const config = loadConfig();
  await verifyBinaries(config.compilationMode, projectRoot, logger);
  scheduler.setMode(config.compilationMode);
  logger.log('start').debug(config);
  logger.log('start').info('Parsing lerna dependency graph', projectRoot);
  try {
    const lernaVersion = execSync('npx lerna -v').toString();
    actions.updateLernaVersion(lernaVersion);
  } catch (e) {
    logger.log('start').warn('cannot determine lerna version');
  }
  actions.parsingGraph();
  actions.setScheduler(scheduler);
  const graph = await getLernaGraph(projectRoot, config, logger, options.defaultPort);
  const server = startServer(graph);

  const io = new IOSocketManager(server, scheduler, logger, graph);
  logger.setIO(io);
  scheduler.setGraph(graph);
  actions.graphParsed();
  actions.setGraph(graph);
  const sockets = new IPCSocketsManager(projectRoot, scheduler, logger, graph);
  await sockets.createServer();
  graph.registerIPCServer(sockets);
  graph.registerIOSockets(io);
  launch({
    startingUrl: 'http://localhost:' + 4545,
  }).then((chrome) => {
    console.log(`Chrome debugging port running on ${chrome.port}`);
  });
  await graph.bootstrap().catch((e) => {
    const message =
      'Error installing microservices dependencies. Run in verbose mode (export MILA_DEBUG=*) for more infos.';
    logger.log('start').error(e);
    logger.log('start').error(message);
    actions.lernaErrored();
    // eslint-disable-next-line no-console
    console.error(message);
    process.exit(1);
  });
  actions.graphBootstrapped();
  logger.log('start').debug('Services excluded by config', config.noStart);
  const enabledServices = graph.getServices().filter((s) => !config.noStart.includes(s.getName()));
  logger.log('start').debug(
    'Enabled services',
    enabledServices.map((s) => s.getName()),
  );

  let chosenServices: Service[] = [];

  // TODO: Implement my own service selector in react
  if (options.interactive) {
    await interactive(enabledServices, 'Please select the microservices you wants to start', logger).then(
      (s) => (chosenServices = s),
    );
  } else {
    chosenServices = enabledServices;
  }
  logger.log('start').debug(
    'Chosen services',
    chosenServices.map((s) => s.getName()),
  );
  chosenServices.forEach((s) => s.enable());
  graph.enableNodes();

  logger.log('start').debug(
    'Enabled nodes',
    graph
      .getNodes()
      .filter((n) => n.isEnabled())
      .map((n) => n.getName()),
  );

  recreateLogDirectory(projectRoot, logger);

  logger.log('start').info(`Found ${chosenServices.length} services`);
  logger.log('start').info('Starting services');
  logger.log('start').debug(chosenServices);
  await scheduler.startProject(graph, options.recompile);

  graph
    .getNodes()
    .filter((n) => n.isEnabled())
    .forEach((n) => n.watch(scheduler));
  process.on('SIGINT', async () => {
    logger.log('start').warn('SIGINT signal received');
    await scheduler.stopProject(graph);
    process.exit();
  });
};
