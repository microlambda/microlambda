/* eslint-disable no-console */
import { startServer, IOSocketManager } from '@microlambda/server';
import { showOff } from '../utils/ascii';
import ora from 'ora';
import chalk from 'chalk';
import {
  getGraphFromYarnProject,
  getProjectRoot,
  verifyBinaries,
  RecompilationScheduler,
  recreateLogDirectory,
  Logger,
  IPCSocketsManager,
  DependenciesGraph,
  ConfigReader,
  IConfig,
} from '@microlambda/core';

interface IStartOptions {
  interactive: boolean;
  recompile: boolean;
  defaultPort: number;
}

export const validateConfig = (config: ConfigReader, graph: DependenciesGraph): IConfig => {
  const validating = ora('Validating config 🔧').start();
  try {
    config.validate(graph);
  } catch (e) {
    validating.fail('Invalid microlambda config file');
    console.error(chalk.red('Please check the docs and provide a valid configuration.'));
    console.error(chalk.red(e));
    process.exit(1);
  }
  validating.succeed('Config valid');
  return config.config;
};

export const readConfig = async (projectRoot: string, logger: Logger): Promise<ConfigReader> => {
  const loadingConfig = ora('Loading config ⚙️').start();
  const reader = new ConfigReader(logger);
  let config: IConfig;
  try {
    config = reader.readConfig();
  } catch (e) {
    loadingConfig.fail('Cannot read microlambda config file');
    console.error(chalk.red(e));
    process.exit(1);
  }
  // FIXME: Implement real strategy about this
  // await verifyBinaries(config.compilationMode, projectRoot, logger);
  logger.log('start').debug(config);
  loadingConfig.succeed();
  return reader;
};

export const getDependenciesGraph = async (
  projectRoot: string,
  scheduler: RecompilationScheduler,
  config: IConfig,
  logger: Logger,
  defaultPort?: number,
): Promise<DependenciesGraph> => {
  const parsingGraph = ora('Parsing dependency graph 🧶').start();
  const graph = await getGraphFromYarnProject(projectRoot, scheduler, config, logger, defaultPort);
  parsingGraph.succeed();
  return graph;
};

export const init = async (
  logger: Logger,
  scheduler: RecompilationScheduler,
  defaultPort?: number,
): Promise<{ projectRoot: string; config: IConfig; graph: DependenciesGraph }> => {
  const log = logger.log('start');
  const projectRoot = getProjectRoot(logger);
  log.info('Project root resolved', projectRoot);
  const config = await readConfig(projectRoot, logger);
  const graph = await getDependenciesGraph(projectRoot, scheduler, config.config, logger, defaultPort);
  validateConfig(config, graph);
  return { projectRoot, config: config.config, graph };
};

// TODO: Install dependencies just in case
/*export const yarnInstall = async (graph: DependenciesGraph, logger: Logger): Promise<void> => {
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
  installing.text = 'Dependencies installed 📦';
  installing.succeed();
};*/

export const start = async (
  scheduler: RecompilationScheduler,
  options: IStartOptions,
  logger: Logger,
): Promise<void> => {
  console.info(showOff());

  const { projectRoot, config, graph } = await init(logger, scheduler, options.defaultPort);

  // await yarnInstall(graph, logger);

  const startingServer = ora('Starting server').start();
  const server = await startServer(graph, logger);
  startingServer.text = 'Mila server started on http://localhost:4545 ✨';
  startingServer.succeed();
  const starting = ora('Application started 🚀 !').start();
  starting.succeed();

  scheduler.setGraph(graph);

  const io = new IOSocketManager(server, scheduler, logger, graph);
  graph.getServices().forEach((service) => {
    service.status$.subscribe((status) => io.statusUpdated(service, status));
    service.slsLogs$.subscribe((log) => io.handleServiceLog(service.getName(), log));
  });
  graph.getNodes().forEach((node) => {
    node.tscLogs$.subscribe((log) => io.handleTscLogs(node.getName(), log));
    node.typeCheck$.subscribe((typeCheckStatus) => io.typeCheckStatusUpdated(node, typeCheckStatus));
    node.transpiled$.subscribe((transpileStatus) => io.transpilingStatusUpdated(node, transpileStatus));
  });

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

  process.on('SIGINT', async () => {
    logger.log('start').warn('SIGINT signal received');
    console.log('\n');
    const gracefulShutdown = ora('Gracefully shutting down services ☠️');
    try {
      await scheduler.stopProject(graph);
    } catch (e) {
      console.error('Error stopping services. Allocated ports may still be busy !');
      process.exit(2);
    }
    gracefulShutdown.succeed();
    process.exit(0);
  });

  if (!options.interactive) {
    logger.log('start').info('Starting services');
    await scheduler.startProject(graph, options.recompile);
  }
};
