import { EventsLog } from '@microlambda/logger';
import { init } from "./start";
import chalk from "chalk";
import { join } from 'path';
import { existsSync } from "fs";
import { readJSONSync } from "fs-extra";

export const logs = async (serviceName: string, cmd: string, logger: EventsLog): Promise<void> => {
  const { project } = await init(logger);
  const service = project.services.get(serviceName);
  if (!service) {
    console.error(chalk.red('Unknown service', serviceName));
    process.exit(1);
  }
  const logsFile = join(service?.root, '.caches', cmd || 'start', 'output.json');
  if (existsSync(logsFile)) {
    const output = readJSONSync(logsFile);
    for (const result of output) {
      console.info(result.command);
      console.info(result.stdout);
      console.error(result.stderr);
      console.info('Process exited with status', result.exitCode)
    }
  } else {
    console.warn(chalk.yellow('No logs found for command', cmd || 'start', 'on service', serviceName));
  }
};
