import { Logger } from '../utils/logger';
import { getProjectRoot } from '../utils/get-project-root';
import { getLernaGraph } from '../utils/get-lerna-graph';
import { RecompilationScheduler } from '../utils/scheduler';

interface ITestOptions {
  bootstrap: boolean;
  recompile: boolean;
  unit: boolean;
  functional: boolean;
  concurrency?: number;
  service?: string;
}

export const runTests = async (
  scheduler: RecompilationScheduler,
  options: ITestOptions,
  logger: Logger,
): Promise<void> => {
  // TODO: Display UI with spinners for build safe + test (concurrency in option)
  // TODO: Display errored test case
  /*logger.log('test-runner').debug('Launching tests', options);
  logger.log('test-runner').info('Running tests for', options.service || 'all services');
  const projectRoot = getProjectRoot(logger);
  logger.log('test-runner').debug('Loading config');
  const config = loadConfig();
  scheduler.setMode('safe');
  logger.log('start').debug(config);
  logger.log('start').info('Parsing lerna dependency graph', projectRoot);
  const graph = await getLernaGraph(projectRoot, scheduler, config, logger);
  if (options.bootstrap) {
    await graph.bootstrap().catch((e) => {
      logger.log('test-runner').error(e);
      logger
        .log('test-runner')
        .error(
          'Error installing microservices dependencies. Run in verbose mode (export MILA_DEBUG=*) for more infos.',
        );
      process.exit(1);
    });
  }
  if (options.recompile) {
    const toCompile = options.service ? graph.getNodes().find((n) => n.getName() === options.service) : graph;
    await scheduler.compile(toCompile);
  }*/
};
