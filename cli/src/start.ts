import { showOff } from './utils/ascii';
import { getProjectRoot } from './utils/get-project-root';
import { loadConfig } from './config/load-config';
import { getLernaGraph } from './utils/get-lerna-graph';
import { log } from './utils/logger';
import { recreateLogDirectory } from './utils/logs';

export const start = async (defaultPort = 3001) => {
  showOff();
  log.info('Starting up the app');
  const projectRoot = getProjectRoot();
  log.debug('Loading config');
  const config = loadConfig();
  log.debug(config);
  log.info('Parsing lerna dependency graph', projectRoot);
  const graph = getLernaGraph(projectRoot, config, defaultPort);
  await graph.bootstrap().catch(() => {
    log.error('Error installing microservices dependencies. Run in verbose mode (export MILA_DEBUG=*) for more infos.');
    process.exit(1);
  });
  await graph.compile().catch(() => {
    log.error('Error compiling dependencies graph. Run in verbose mode (export MILA_DEBUG=*) for more infos.');
    process.exit(1);
  });
  const services = graph.getServices();
  recreateLogDirectory(projectRoot);
  log.info(`Found ${services.length} services`);
  log.info('Starting services');
  log.debug(services);
  services.forEach(s => s.start().catch((err) => {
    log.error(`Could not start ${s.getName()}`, err);
  }));
  process.on('SIGINT', async () => {
    log.warn('SIGINT signal received');
    services.forEach(s => s.stop());
    process.exit();
  });
};
