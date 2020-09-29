import { getProjectRoot } from '../utils/get-project-root';
import { loadConfig } from '../config/load-config';
import { getLernaGraph } from '../utils/get-lerna-graph';
import { recreateLogDirectory } from '../utils/logs';
import { RecompilationScheduler } from '../utils/scheduler';
import { verifyBinaries } from '../utils/external-binaries';
import { execSync } from 'child_process';
import { startServer } from '../server';
import { IOSocketManager } from '../server/socket';
import { Logger } from '../utils/logger';
import { IPCSocketsManager } from '../ipc/socket';
import { showOff } from '../utils/ascii';
import ora from 'ora';
import { LernaGraph } from '../lerna';
import { IConfig } from '../config/config';

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

  console.log(showOff());
  const log = logger.log('start');
  const projectRoot = getProjectRoot(logger);
  log.info('Project root resolved', projectRoot)

  const config = await readConfig(projectRoot, logger);

  const graph = await parseGraph(projectRoot, scheduler, config, logger, options.defaultPort);

  await lernaBootstrap(graph, logger);

  const startingServer = ora('Starting server').start();
  const server = await startServer(graph, logger);
  startingServer.text = 'Mila server started on http://localhost:4545 ✨';
  startingServer.succeed();
  const starting = ora('Application started 🚀 !').start();
  starting.succeed();

  scheduler.setGraph(graph);

  const io = new IOSocketManager(server, scheduler, logger, graph);
  logger.setIO(io);
  graph.registerIOSockets(io);

  const ipc = new IPCSocketsManager(projectRoot, scheduler, logger, graph);
  await ipc.createServer();
  graph.registerIPCServer(ipc);

  logger.log('start').debug('Services excluded by config', config.noStart);
  const enabledServices = graph.getServices().filter((s) => !config.noStart.includes(s.getName()));
  logger.log('start').debug(
    'Enabled services',
    enabledServices.map((s) => s.getName()),
  );
  enabledServices.forEach((s) => s.enable());
  graph.enableNodes();
  logger.log('start').debug(
    'Enabled nodes',
    graph
      .getNodes()
      .filter((n) => n.isEnabled())
      .map((n) => n.getName()),
  );

  recreateLogDirectory(projectRoot, logger);

  if (!options.interactive) {
    logger.log('start').info('Starting services');
    await scheduler.startProject(graph, options.recompile);
  }

  process.on('SIGINT', async () => {
    logger.log('start').warn('SIGINT signal received');
    console.log('\n');
    const gracefulShutdown = ora('Gracefully shutting down services ☠️')
    try {
      await scheduler.stopProject(graph);
    } catch (e) {
      console.error('Error stopping services. Allocated ports may still be busy !');
      process.exit(2);
    }
    gracefulShutdown.succeed();
    process.exit(0);
  });
};

export const resolveProjectRoot = () => {

};

export const readConfig = async (projectRoot: string, logger: Logger): Promise<IConfig> => {
  const loadingConfig = ora('Loading config ⚙️').start();
  const config = loadConfig();
  await verifyBinaries(config.compilationMode, projectRoot, logger);
  logger.log('start').debug(config);
  loadingConfig.succeed();
  return config;
}

export const parseGraph = async (projectRoot: string, scheduler: RecompilationScheduler, config: IConfig, logger: Logger, defaultPort?: number) => {
  let lernaVersion: string;
  try {
    lernaVersion = execSync('npx lerna -v').toString();
    logger.log('graph').info('Using lerna', lernaVersion);
  } catch (e) {
    logger.log('graph').warn('cannot determine lerna version');
  }
  const parsingGraph = ora('Parsing lerna dependency graph 🐉').start();
  const graph = await getLernaGraph(projectRoot, scheduler, config, logger, defaultPort);
  parsingGraph.succeed();
  return graph;
}

export const lernaBootstrap = async (graph: LernaGraph, logger: Logger): Promise<void> => {
  const installing = ora('Installing dependencies 📦').start();
  await graph.bootstrap().catch((e) => {
    const message =
      'Error installing microservices dependencies. Run in verbose mode (export MILA_DEBUG=*) for more infos.';
    logger.log('bootstrap').error(e);
    logger.log('bootstrap').error(message);
    // eslint-disable-next-line no-console
    console.error(message);
    process.exit(1);
  });
  installing.text = 'Dependencies installed 📦'
  installing.succeed();
}
