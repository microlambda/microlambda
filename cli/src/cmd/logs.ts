import { getProjectRoot } from '../utils/get-project-root';
import { loadConfig } from '../config/load-config';
import { Service } from '../lerna';
import { getLernaGraph } from '../utils/get-lerna-graph';
import { interactive } from '../utils/interactive';
import { tailLogs } from '../utils/logs';
import { Logger } from '../utils/logger';
import { RecompilationScheduler } from '../utils/scheduler';

// TODO: make a ink scrollable logs component instead tail (which is not supported in windows)
// TODO: use in memory logs instead files and try to preserve colors
export const logs = async (cmd: { S: string }, logger: Logger, scheduler: RecompilationScheduler): Promise<void> => {
  const projectRoot = getProjectRoot(logger);
  const config = loadConfig();
  let services: Service[] = [];
  logger.log('logs').debug(config);

  if (!cmd.S) {
    const graph = await getLernaGraph(projectRoot, scheduler, config, logger, 3001);

    await graph.bootstrap().catch((e) => {
      logger.log('logs').error(e);
      logger
        .log('logs')
        .error(
          'Error installing microservices dependencies. Run in verbose mode (export MILA_DEBUG=*) for more infos.',
        );
      process.exit(1);
    });

    const enabledServices = graph.getServices().filter((s) => !config.noStart.includes(s.getName()));

    await interactive(
      enabledServices,
      'Please select the microservices for which you want to see the logs',
      logger,
    ).then((s: Service[]) => (services = s));

    // Here we need something more consistent to remove the first part of the service name (Depending on the variety of prefix name)
    const servicesName = services.map((s) => s.getName().replace('@project/', ''));

    servicesName.forEach((name: string) => tailLogs(name, projectRoot, logger));
  } else {
    tailLogs(cmd.S, projectRoot, logger);
  }
};
