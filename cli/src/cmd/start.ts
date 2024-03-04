import { IOSocketManager, startServer } from '@microlambda/server';
import { showOff } from '../utils/ascii';
import ora from 'ora';
import { init, recreateLogDirectory } from '@microlambda/core';
import { Scheduler } from '@microlambda/core';
import { EventsLog, EventLogsFileHandler } from '@microlambda/logger';
import { WebsocketLogsHandler } from '../log-handlers/websocket';
import { resolveProjectRoot } from '@microlambda/utils';
import { logger } from '../utils/logger';
import { aws } from '@microlambda/aws';
import chalk from 'chalk';
import { debounceTime } from 'rxjs/operators';
import { ICurrentUserIAM } from '@microlambda/aws/lib/iam/get-current-user';
import { IStateConfig, getStateConfig } from '@microlambda/config';

interface IStartOptions {
  interactive: boolean;
  recompile: boolean;
  port: number;
}

export const start = async (options: IStartOptions): Promise<void> => {
  logger.info(showOff());
  const projectRoot = resolveProjectRoot();
  const eventsLog = new EventsLog(undefined, [new EventLogsFileHandler(projectRoot, `mila-start-${Date.now()}`)]);
  const { project, config } = await init(projectRoot, logger, eventsLog);

  // await yarnInstall(graph, logger);
  const DEFAULT_PORT = 4545;
  const region = process.env.AWS_REGION;
  if (!region) {
    logger?.info('No AWS_REGION exported, using us-east-1');
  }
  let awsUser: ICurrentUserIAM | undefined;
  let stateConfig: IStateConfig | undefined;
  try {
    awsUser = await aws.iam.getCurrentUser();
    logger.lf();
    logger.info('Connected as', chalk.white.bold(awsUser.arn));
    logger.lf();
  } catch (e) {
    logger.lf();
    logger.warn('Not connected to AWS, live environments infos will be not available.');
    logger.lf();
  }
  try {
    const stateConfig = getStateConfig(config, awsUser?.projectId);
  } catch (e) {
    logger.lf();
    logger.warn('Error reading state config');
    logger.warn(e);
    logger.lf();
  }
  const scheduler = new Scheduler(project, region ?? 'us-east-1', eventsLog);
  scheduler.exec(options.interactive ? [] : [...project.services.values()], {
    transpile: 200,
    build: 500,
    start: 500,
  });
  const port = options.port || DEFAULT_PORT;
  const startingServer = ora('Starting server').start();

  const server = await startServer({
    port,
    project,
    logger: eventsLog,
    scheduler,
    config: stateConfig,
  });
  startingServer.text = `Mila server started on http://localhost:${port} ✨`;
  startingServer.succeed();
  const starting = ora('Application started 🚀 !').start();
  starting.succeed();

  const io = new IOSocketManager(options.port || DEFAULT_PORT, server, scheduler, eventsLog);
  for (const workspace of project.workspaces.values()) {
    const ioHandler = new WebsocketLogsHandler(workspace, io);
    workspace.addLogsHandler(ioHandler);
  }

  eventsLog.logs$.pipe(debounceTime(200)).subscribe({
    next: (log) => io.handleEventLog(log),
  });

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
};
