import { existsSync, lstatSync, mkdirSync } from 'fs';
import { join } from "path";

export const getLogsDirectory = (projectRoot: string) => join(projectRoot, '.logs');
export const getLogsPath = (projectRoot: string, service: string) => join(projectRoot, '.logs', `${service}.log`);

export const createLogDirectory = (projectRoot: string) => {
  const logsDirectory = getLogsDirectory(projectRoot);
  if (!existsSync(logsDirectory)) {
    mkdirSync(logsDirectory);
  }
  if (lstatSync(logsDirectory).isDirectory()) {
    console.error(`${logsDirectory} is not a directory`);
  }
};
