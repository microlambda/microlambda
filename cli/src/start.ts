import inquirer from 'inquirer';

import { showOff } from './utils/ascii';
import { getProjectRoot } from './utils/get-project-root';
import { loadConfig } from './config/load-config';
import { getLernaGraph } from './utils/get-lerna-graph';
import { log } from './utils/logger';
import { recreateLogDirectory } from './utils/logs';
import { RecompilationScheduler } from './utils/scheduler';
import { Service } from './lerna';

interface IStartOptions {
  interactive: boolean;
  recompile: boolean;
  defaultPort: number;
}

export const start = async (scheduler: RecompilationScheduler, options: IStartOptions) => {
  showOff();
  log.info('Starting up the app');
  const projectRoot = getProjectRoot();
  log.debug('Loading config');
  const config = loadConfig();
  log.debug(config);
  log.info('Parsing lerna dependency graph', projectRoot);
  const graph = getLernaGraph(projectRoot, config, options.defaultPort);
  await graph.bootstrap().catch(() => {
    log.error('Error installing microservices dependencies. Run in verbose mode (export MILA_DEBUG=*) for more infos.');
    process.exit(1);
  });

  const enabledServices = graph.getServices().filter(s => config.noStart.includes(s.getName()));
  let chosenServices: Service[] = [];

  if (options.interactive) {
    const choices: {microservices: string[]} = await inquirer.prompt({
      type: 'checkbox',
      name: 'microservices',
      message: 'Please select the microservices you wants to start',
      choices: enabledServices.map((service: Service) => service.getName()),
    });
    if (choices.microservices.length !== 0) {
      chosenServices = enabledServices.filter(s => choices.microservices.includes(s.getName()));
    } else {
      log.info('No services to start, exiting...');
      process.exit(0);
    }
  } else {
    chosenServices = enabledServices;
  }

  chosenServices.forEach(s => s.enable());
  graph.enableNodes();

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
  chosenServices.forEach(s => scheduler.requestStart(s));
  await scheduler.exec().catch((err) => {
    log.error('Error starting services. Run in verbose mode (export MILA_DEBUG=*) for more infos.')
  });
  graph.getNodes().forEach(s => s.watch(scheduler));
  process.on('SIGINT', async () => {
    log.warn('SIGINT signal received');
    scheduler.reset();
    chosenServices.forEach(s => scheduler.requestStop(s));
    await scheduler.exec();
    process.exit();
  });
};
