import { showOff } from './utils/ascii';
import { getProjectRoot } from './utils/get-project-root';
import { loadConfig } from './config/load-config';
import { getLernaGraph } from './utils/get-lerna-graph';
import { log } from './utils/logger';
import { interactive } from './utils/interactive';

import { recreateLogDirectory } from './utils/logs';
import { RecompilationScheduler } from './utils/scheduler';
import { Service } from './lerna';

interface IStartOptions {
  interactive: boolean;
  recompile: boolean;
  defaultPort: number;
}

export const start = async (scheduler: RecompilationScheduler, options: IStartOptions): Promise<void> => {
  showOff();
  log.info('Starting up the app');
  const projectRoot = getProjectRoot();
  log.debug('Loading config');
  const config = loadConfig();
  log.debug(config);
  log.info('Parsing lerna dependency graph', projectRoot);
  const graph = await getLernaGraph(projectRoot, config, options.defaultPort);
  await graph.bootstrap().catch((e) => {
    log.error(e);
    log.error('Error installing microservices dependencies. Run in verbose mode (export MILA_DEBUG=*) for more infos.');
    process.exit(1);
  });

  log.debug('Services excluded by config', config.noStart);
  const enabledServices = graph.getServices().filter((s) => !config.noStart.includes(s.getName()));
  log.debug(
    'Enabled services',
    enabledServices.map((s) => s.getName()),
  );

  let chosenServices: Service[] = [];

  if (options.interactive) {
    await interactive(enabledServices, 'Please select the microservices you wants to start').then(
      (s) => (chosenServices = s),
    );
  } else {
    chosenServices = enabledServices;
  }
  log.debug(
    'Chosen services',
    chosenServices.map((s) => s.getName()),
  );
  chosenServices.forEach((s) => s.enable());
  graph.enableNodes();
  log.debug(
    'Enabled nodes',
    graph
      .getNodes()
      .filter((n) => n.isEnabled())
      .map((n) => n.getName()),
  );

  if (options.recompile) {
    await graph.compile(scheduler).catch(() => {
      log.error('Error compiling dependencies graph. Run in verbose mode (export MILA_DEBUG=*) for more infos.');
      process.exit(1);
    });
  }

  recreateLogDirectory(projectRoot);
  log.info(`Found ${chosenServices.length} services`);
  log.info('Starting services');
  log.debug(chosenServices);
  chosenServices.forEach((s) => scheduler.requestStart(s));
  await scheduler.exec().catch((err) => {
    log.error(err);
    log.error('Error starting services. Run in verbose mode (export MILA_DEBUG=*) for more infos.');
  });
  graph.getNodes().forEach((s) => s.watch(scheduler));
  process.on('SIGINT', async () => {
    log.warn('SIGINT signal received');
    scheduler.reset();
    chosenServices.forEach((s) => scheduler.requestStop(s));
    await scheduler.exec();
    process.exit();
  });
};
