import { closeSync, existsSync, lstatSync, mkdirSync, openSync, stat } from 'fs';
import rimraf from 'rimraf';
import { join, dirname } from 'path';
import { spawnSync } from 'child_process';
import { Logger } from '@microlambda/logger';
import { ServerlessAction } from '@microlambda/types';

// TODO: Move in $service/.microlambda/{logs,hashes,package}
export const getLogsDirectory = (projectRoot: string): string => join(projectRoot, '.mila', 'logs');
export const getLogsPath = (projectRoot: string, service: string, type: ServerlessAction, region?: string): string => {
  const segments = service.split('/');
  const name = segments[segments.length - 1];
  const fieName = region ? `${name}.${type}.${region}.log` : `${name}.${type}.log`;
  return join(getLogsDirectory(projectRoot), fieName);
};

export const recreateLogDirectory = (projectRoot: string, logger: Logger): void => {
  const logsDirectory = getLogsDirectory(projectRoot);
  if (!existsSync(logsDirectory)) {
    // Logs directory does not exists => create it
    mkdirSync(logsDirectory, { recursive: true });
    return;
  }
  if (!lstatSync(logsDirectory).isDirectory()) {
    // Path <project-root>/.logs exists but is a file / symlink etc..=> weird => throw
    logger.log('logs').error(`${logsDirectory} is not a directory`);
    process.exit(1);
  }
  rimraf.sync(logsDirectory);
  mkdirSync(logsDirectory);
};

export const createLogFile = (projectRoot: string, service: string, type: ServerlessAction, region?: string): void => {
  const logsPath = getLogsPath(projectRoot, service, type, region);
  if (!existsSync(dirname(logsPath))) {
    mkdirSync(dirname(logsPath), { recursive: true });
  }
  if (!existsSync(logsPath)) {
    closeSync(openSync(logsPath, 'w'));
  }
};

export const tailLogs = (serviceName: string, projectRoot: string, logger: Logger): void => {
  const logsDirectory = getLogsDirectory(projectRoot);

  stat(`${logsDirectory}/${serviceName}.log`, (exists) => {
    if (exists === null) {
      // showOffTitle(serviceName);
      spawnSync('tail', ['-n', '+1', `${logsDirectory}/${serviceName}.log`], {
        stdio: 'inherit',
      });
    } else {
      logger
        .log('logs')
        .error(
          `There is not logs for the ${serviceName} service or the service specified does not exist.\n\tPlease run 'mila start' command first!`,
        );
    }
  });
};
