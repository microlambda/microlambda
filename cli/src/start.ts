import { showOff } from './utils/ascii';
import { getProjectRoot } from './utils/get-project-root';
import { loadConfig } from './config/load-config';
import { getLernaGraph } from './utils/get-lerna-graph';
import { log } from './utils/logger';
import { recreateLogDirectory } from './utils/logs';
import { RecompilationScheduler } from './utils/scheduler';

interface IStartOptions {
  interactive: boolean;
  recompile: boolean;
  defaultPort: number;
}

export const start = async (scheduler: RecompilationScheduler, options : IStartOptions) => {
  showOff();
  log.info('Starting up the app');
  const projectRoot = getProjectRoot();
  log.debug('Loading config');
  const config = loadConfig();
  log.debug(config);
  log.info('Parsing lerna dependency graph', projectRoot);
  const graph = getLernaGraph(projectRoot, config, options.defaultPort);
  graph.setNoStart(config.noStart);
  await graph.bootstrap().catch(() => {
    log.error('Error installing microservices dependencies. Run in verbose mode (export MILA_DEBUG=*) for more infos.');
    process.exit(1);
  });
  if (options.recompile) {
    await graph.compile(scheduler).catch(() => {
      log.error('Error compiling dependencies graph. Run in verbose mode (export MILA_DEBUG=*) for more infos.');
      process.exit(1);
    });
  }
  const services = graph.getServices();
  recreateLogDirectory(projectRoot);
  log.info(`Found ${services.length} services`);
  log.info('Starting services');
  log.debug(services);
  const toStart =  services.filter(s => !config.noStart.includes(s.getName()));
  toStart.forEach(s => scheduler.requestStart(s));
  await scheduler.exec().catch((err) => {
    log.error('Error starting services. Run in verbose mode (export MILA_DEBUG=*) for more infos.')
  });
  graph.getNodes().forEach(s => s.watch(scheduler));
  process.on('SIGINT', async () => {
    log.warn('SIGINT signal received');
    scheduler.reset();
    toStart.forEach(s => scheduler.requestStop(s));
    await scheduler.exec();
    process.exit();
  });
};
