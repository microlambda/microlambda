import { EventsLog } from '@microlambda/logger';
import { init } from "./start";
import chalk from "chalk";
import { join } from 'path';
import { existsSync } from "fs";
import { readJSONSync } from "fs-extra";
import { logger } from '../utils/logger';
import { resolveProjectRoot } from '@microlambda/utils';
import { EventLogsFileHandler } from '@microlambda/logger';

export const logs = async (serviceName: string, cmd: string): Promise<void> => {
  const projectRoot = resolveProjectRoot();
  const eventsLog = new EventsLog(undefined, [new EventLogsFileHandler(projectRoot, `mila-logs-${Date.now()}`)]);
  const { project } = await init(projectRoot, eventsLog);
  const service = project.services.get(serviceName);
  if (!service) {
    logger.error(chalk.red('Unknown service', serviceName));
    process.exit(1);
  }
  const logsFile = join(service?.root, '.caches', cmd || 'start', 'output.json');
  if (existsSync(logsFile)) {
    const output = readJSONSync(logsFile);
    for (const result of output) {
      logger.info(result.command);
      logger.info(result.stdout);
      logger.error(result.stderr);
      logger.info('Process exited with status', result.exitCode)
    }
  } else {
    logger.warn(chalk.yellow('No logs found for command', cmd || 'start', 'on service', serviceName));
  }
};
