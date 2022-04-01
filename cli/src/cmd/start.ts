/* eslint-disable no-console */
import { IOSocketManager, startServer } from "@microlambda/server";
import { showOff } from '../utils/ascii';
import ora from 'ora';
import chalk from 'chalk';
import {
  Project,
  recreateLogDirectory,
  Logger,
  ConfigReader,
  IConfig,
} from '@microlambda/core';
import { resolveProjectRoot, RunCommandEventEnum } from "@centipod/core";
import {command} from "execa";
import { Scheduler } from "@microlambda/core";

interface IStartOptions {
  interactive: boolean;
  recompile: boolean;
  port: number;
}

export const validateConfig = (config: ConfigReader, graph: Project): IConfig => {
  const validating = ora('Validating config 🔧').start();
  try {
    const validated = config.validate(graph);
    validating.succeed('Config valid');
    return validated;
  } catch (e) {
    validating.fail('Invalid microlambda config file');
    console.error(chalk.red('Please check the docs and provide a valid configuration.'));
    console.error(chalk.red(e));
    process.exit(1);
  }
};

export const readConfig = async (
  projectRoot: string,
  logger: Logger,
): Promise<{ reader: ConfigReader; config: IConfig }> => {
  const loadingConfig = ora('Loading config ⚙️').start();
  const reader = new ConfigReader(logger);
  let config: IConfig;
  try {
    config = reader.readConfig();
    logger.log('start').debug(config);
    loadingConfig.succeed();
    return { reader, config };
  } catch (e) {
    loadingConfig.fail('Cannot read microlambda config file');
    console.error(chalk.red(e));
    process.exit(1);
  }
};

export const getDependenciesGraph = async (projectRoot: string): Promise<Project> => {
  const parsingGraph = ora('Parsing dependency graph 🧶').start();
  const graph = await Project.loadProject(projectRoot);
  parsingGraph.succeed();
  return graph;
};

export const init = async (
  logger: Logger,
): Promise<{ projectRoot: string; config: IConfig; project: Project }> => {
  const log = logger.log('start');
  const projectRoot = resolveProjectRoot();
  log.info('Project root resolved', projectRoot);
  const project =  await getDependenciesGraph(projectRoot);
  const { config, reader } = await readConfig(projectRoot, logger);
  validateConfig(reader, project);
  return { projectRoot, config: config, project };
};

export const yarnInstall = async (project: Project, logger: Logger): Promise<void> => {
  const installing = ora('Installing dependencies 📦').start();
  try {
    await command('yarn install', {
      cwd: project.root,
      stdio: process.env.MILA_DEBUG?.split(',').includes('packagr') ? 'inherit' : 'pipe',
    });
  } catch (e) {
    const message =
      'Error installing microservices dependencies. Run in verbose mode (export MILA_DEBUG=*) for more infos.';
    logger.log('bootstrap').error(e);
    logger.log('bootstrap').error(message);
    // eslint-disable-next-line no-console
    console.error(message);
    process.exit(1);
  }
  installing.text = 'Dependencies installed 📦';
  installing.succeed();
};

export const start = async (
  options: IStartOptions,
  logger: Logger,
): Promise<void> => {
  console.info(showOff());

  const { projectRoot, config, project } = await init(logger);

  // await yarnInstall(graph, logger);

  const scheduler = new Scheduler(project, logger);
  const startingServer = ora('Starting server').start();
  const server = await startServer(options.port, project, logger, scheduler);
  startingServer.text = 'Mila server started on http://localhost:4545 ✨';
  startingServer.succeed();
  const starting = ora('Application started 🚀 !').start();
  starting.succeed();

  const io = new IOSocketManager(options.port, server, scheduler, logger, project);
  // logger.logs$.subscribe((evt) => io.eventLogAdded(evt));
  /*project.services.forEach((service) => {
    service.status$.subscribe((status) => io.statusUpdated(service, status));
    const offlineLogs$ = service.logs$.start.default;
    if (offlineLogs$) {
      offlineLogs$.subscribe((log) => io.handleServiceLog(service.getName(), log));
    } else {
      logger.log('start').error('Cannot subscribe to offline logs');
    }
  });
  graph.getNodes().forEach((node) => {
    node.tscLogs$.subscribe((log) => io.handleTscLogs(node.getName(), log));
    node.typeCheck$.subscribe((typeCheckStatus) => io.typeCheckStatusUpdated(node, typeCheckStatus));
    node.transpiled$.subscribe((transpileStatus) => io.transpilingStatusUpdated(node, transpileStatus));
  });
  scheduler.status$.subscribe((status) => io.schedulerStatusChanged(status));*/

  /*const ipc = new IPCSocketsManager(projectRoot, scheduler, logger, graph);
  await ipc.createServer();
  graph.registerIPCServer(ipc);*/

  recreateLogDirectory(projectRoot, logger);

  process.on('SIGINT', async () => {
    logger.log('start').warn('SIGINT signal received');
    console.log('\n');
    const gracefulShutdown = ora('Gracefully shutting down services ☠️');
    try {
      await scheduler.gracefulShutdown();
    } catch (e) {
      console.error('Error stopping services. Allocated ports may still be busy !');
      process.exit(2);
    }
    gracefulShutdown.succeed();
    process.exit(0);
  });

  if (!options.interactive) {
    logger.log('start').info('Starting services');
    await scheduler.startAll();
  }
};
