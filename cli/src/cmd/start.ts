import { IOSocketManager, startServer } from "@microlambda/server";
import { showOff } from '../utils/ascii';
import ora from 'ora';
import chalk from 'chalk';
import {
  Project,
  recreateLogDirectory,
  ConfigReader,
  IConfig,
} from '@microlambda/core';
import {command} from "execa";
import { Scheduler } from "@microlambda/core";
import { EventsLog, EventLogsFileHandler } from "@microlambda/logger";
import { WebsocketLogsHandler } from "../log-handlers/websocket";
import { resolveProjectRoot } from '@microlambda/utils';
import { logger } from '../utils/logger';

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
    logger.error(chalk.red('Please check the docs and provide a valid configuration.'));
    logger.error(chalk.red(e));
    process.exit(1);
  }
};

export const readConfig = async (
  projectRoot: string,
  eventsLog: EventsLog,
): Promise<{ reader: ConfigReader; config: IConfig }> => {
  const loadingConfig = ora('Loading config ⚙️').start();
  const reader = new ConfigReader(eventsLog);
  let config: IConfig;
  try {
    config = reader.readConfig();
    eventsLog.scope('start').debug(config);
    loadingConfig.succeed();
    return { reader, config };
  } catch (e) {
    loadingConfig.fail('Cannot read microlambda config file');
    logger.error(chalk.red(e));
    process.exit(1);
  }
};

export const getDependenciesGraph = async (projectRoot: string, logger?: EventsLog): Promise<Project> => {
  const parsingGraph = ora('Parsing dependency graph 🧶').start();
  const graph = await Project.loadProject(projectRoot, logger);
  parsingGraph.succeed();
  return graph;
};

export const init = async (
  projectRoot: string,
  eventsLog: EventsLog,
): Promise<{ config: IConfig; project: Project }> => {
  const log = eventsLog.scope('init');
  log.info('Project root resolved', projectRoot);
  const project =  await getDependenciesGraph(projectRoot, eventsLog);
  const { config, reader } = await readConfig(projectRoot, eventsLog);
  validateConfig(reader, project);
  return { config: config, project };
};

export const yarnInstall = async (project: Project, eventsLog: EventsLog): Promise<void> => {
  const installing = ora('Installing dependencies 📦').start();
  try {
    await command('yarn install', {
      cwd: project.root,
      stdio: process.env.MILA_DEBUG?.split(',').includes('packagr') ? 'inherit' : 'pipe',
    });
  } catch (e) {
    const message =
      'Error installing microservices dependencies. Run in verbose mode (export MILA_DEBUG=*) for more infos.';
    eventsLog.scope('bootstrap').error(e);
    eventsLog.scope('bootstrap').error(message);
    logger.error(message);
    process.exit(1);
  }
  installing.text = 'Dependencies installed 📦';
  installing.succeed();
};

export const start = async (
  options: IStartOptions,
): Promise<void> => {
  logger.info(showOff());
  const projectRoot = resolveProjectRoot();
  const eventsLog = new EventsLog(undefined, [new EventLogsFileHandler(projectRoot, `mila-start-${Date.now()}`)]);
  const { project } = await init(projectRoot, eventsLog);

  // await yarnInstall(graph, logger);
  const DEFAULT_PORT = 4545;
  const scheduler = new Scheduler(project, eventsLog);
  const startingServer = ora('Starting server').start();
  const server = await startServer(options.port || DEFAULT_PORT, project, eventsLog, scheduler);
  startingServer.text = 'Mila server started on http://localhost:4545 ✨';
  startingServer.succeed();
  const starting = ora('Application started 🚀 !').start();
  starting.succeed();

  const io = new IOSocketManager(options.port || DEFAULT_PORT, server, scheduler, eventsLog, project);
  for (const workspace of project.workspaces.values()) {
    const ioHandler = new WebsocketLogsHandler(workspace, io);
    workspace.addLogsHandler(ioHandler);
  }
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

  recreateLogDirectory(projectRoot, eventsLog);

  process.on('SIGINT', async () => {
    eventsLog.scope('start').warn('SIGINT signal received');
    logger.lf();
    const gracefulShutdown = ora('Gracefully shutting down services ☠️');
    try {
      await scheduler.gracefulShutdown();
    } catch (e) {
      logger.error('Error stopping services. Allocated ports may still be busy !');
      process.exit(2);
    }
    gracefulShutdown.succeed();
    process.exit(0);
  });

  if (!options.interactive) {
    eventsLog.scope('start').info('Starting services');
    await scheduler.startAll();
  }
};
