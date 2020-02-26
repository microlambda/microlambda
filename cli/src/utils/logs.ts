import { closeSync, existsSync, lstatSync, mkdirSync, openSync } from 'fs';
import rimraf from 'rimraf';
import { join } from 'path';
import { log } from './logger';

export const getLogsDirectory = (projectRoot: string): string => join(projectRoot, '.logs');
export const getLogsPath = (projectRoot: string, service: string): string => {
  const segments = service.split('/');
  const name = segments[segments.length - 1];
  return join(projectRoot, '.logs', `${name}.log`);
};

export const recreateLogDirectory = (projectRoot: string): void => {
  const logsDirectory = getLogsDirectory(projectRoot);
  if (!existsSync(logsDirectory)) {
    // Logs directory does not exists => create it
    mkdirSync(logsDirectory);
    return;
  }
  if (!lstatSync(logsDirectory).isDirectory()) {
    // Path <project-root>/.logs exists but is a file / symlink etc..=> weird => throw
    log.error(`${logsDirectory} is not a directory`);
    process.exit(1);
  }
  rimraf.sync(logsDirectory);
  mkdirSync(logsDirectory);
};

export const createLogFile = (projectRoot: string, service: string): void => {
  const logsPath = getLogsPath(projectRoot, service);
  if (!existsSync(logsPath)) {
    closeSync(openSync(logsPath, 'w'));
  }
};
