import { IOSocketManager, startServer } from "@microlambda/server";
import { showOff } from '../utils/ascii';
import ora from 'ora';
import {
  recreateLogDirectory,
} from '@microlambda/core';
import { Scheduler } from "@microlambda/core";
import { EventsLog, EventLogsFileHandler } from "@microlambda/logger";
import { WebsocketLogsHandler } from "../log-handlers/websocket";
import { resolveProjectRoot } from '@microlambda/utils';
import { logger } from '../utils/logger';
import { init } from '../utils/init';

interface IStartOptions {
  interactive: boolean;
  recompile: boolean;
  port: number;
}

export const start = async (
  options: IStartOptions,
): Promise<void> => {
  logger.info(showOff());
  // TODO: Very AWS token
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
