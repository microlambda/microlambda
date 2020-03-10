import { closeSync, existsSync, lstatSync, mkdirSync, openSync, stat } from 'fs';
import rimraf from 'rimraf';
import { join } from 'path';
import { spawnSync } from 'child_process';

import { log } from './logger';
import { getProjectRoot } from './get-project-root';
import { interactive } from './interactive';
import { getLernaGraph } from './get-lerna-graph';
import { loadConfig } from '../config/load-config';
import { Service } from '../lerna';
import { showOffTitle } from './ascii';

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

export const tailLogs = (serviceName: string, projectRoot: string): void => {
  const logsDirectory = getLogsDirectory(projectRoot);

  stat(`${logsDirectory}/${serviceName}.log`, (exists) => {
    if (exists === null) {
      showOffTitle(serviceName);
      spawnSync('tail', ['-n', '+1', `${logsDirectory}/${serviceName}.log`], { stdio: 'inherit' });
    } else {
      log.error(
        `There is not logs for the ${serviceName} service or the service specified does not exist.\n\tPlease run 'mila start' command first!`,
      );
    }
  });
};

export const tailServiceLogs = async (cmd: { S: string }) => {
  const projectRoot = getProjectRoot();
  const config = loadConfig();
  let services: Service[] = [];
  log.debug(config);

  if (!cmd.S) {
    const graph = await getLernaGraph(projectRoot, config, 3001);

    await graph.bootstrap().catch((e) => {
      log.error(e);
      log.error(
        'Error installing microservices dependencies. Run in verbose mode (export MILA_DEBUG=*) for more infos.',
      );
      process.exit(1);
    });

    const enabledServices = graph.getServices().filter((s) => !config.noStart.includes(s.getName()));

    await interactive(enabledServices, 'Please select the microservices for which you want to see the logs').then(
      (s: Service[]) => (services = s),
    );

    // Here we need something more consistent to remove the first part of the service name (Depending on the variety of prefix name)
    const servicesName = services.map((s) => s.getName().replace('@project/', ''));

    servicesName.forEach((name: string) => tailLogs(name, projectRoot));
  } else {
    tailLogs(cmd.S, projectRoot);
  }
};
