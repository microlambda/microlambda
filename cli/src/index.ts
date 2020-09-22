#!/usr/bin/env node
import { Command } from 'commander';
import { RecompilationScheduler } from './utils/scheduler';
import { start, stop } from './cmd';
import { status } from './cmd/status';
import { restart } from './cmd/restart';
import { logs } from './cmd/logs';
import { runTests } from './cmd/test';
import { Logger } from './utils/logger';

// Logger must be a singleton
const logger = new Logger();
// Recompilation Scheduler must be a singleton
const scheduler = new RecompilationScheduler(logger);

const program = new Command();

program.version('0.0.8alpha');

program
  .command('start')
  .option('-i, --interactive', 'interactively choose microservices', false)
  .option('-d, --discrete', 'start the app in background without logging in console', false)
  .option('-p <port>, --port <port>', 'if not specified in config, start microservices from port', 3001)
  .option('-n, --no-recompile', 'avoid recompiling dependency graph before starting microservices')
  .option('-s <service>, --service <service>', 'the service for which you want to start', false)
  .description('start microlambda services')
  .action(async (cmd) => {
    const options = {
      recompile: cmd.recompile,
      service: cmd.S,
      defaultPort: cmd.P || 3001,
      interactive: cmd.interactive,
    };
    logger.log('cmd').debug(options);
    await start(scheduler, options, logger);
  });

program
  .command('logs')
  .requiredOption('-s <service>, --service <service>', 'the service for which you want to see logs', false)
  .description('print service logs')
  .action(async (cmd) => {
    await logs(cmd, logger);
  });

program
  .command('stop')
  .option('-i, --interactive', 'interactively choose microservices', false)
  .option('-s <service>, --service <service>', 'the service you want to stop', false)
  .description('stop microlambda services')
  .action(async (cmd) => {
    await stop(scheduler, cmd.S);
  });

program
  .command('restart')
  .option('-i, --interactive', 'interactively choose microservices', false)
  .option('-s <service>, --service <service>', 'the service you want to restart', false)
  .description('restart microlambda services')
  .action(async (cmd) => {
    await restart(scheduler, cmd.S);
  });

program
  .command('package')
  .option('-i, --interactive', 'interactively choose microservices', false)
  .option('-s <service>, --service <service>', 'the service you want to package', false)
  .description('package services source code')
  .action(async (cmd) => {
    logger.log('cmd').debug(cmd);
    logger.log('cmd').error('Not implemented');
  });

program
  .command('deploy')
  .option('-i, --interactive', 'interactively choose microservices', false)
  .option('-s <service>, --service <service>', 'the service you want to deploy', false)
  .description('deploy services to AWS')
  .action(async (cmd) => {
    logger.log('cmd').debug(cmd);
    logger.log('cmd').error('Not implemented');
  });

program
  .command('status')
  .description('see the microservices status')
  .action(async () => {
    await status(scheduler, logger);
  });

program
  .command('test')
  .description('test microlambda services')
  .option('--no-bootstrap', 'skip reinstalling dependencies before starting microservices', false)
  .option('--no-recompile', 'skip recompiling dependency graph before starting microservices', false)
  .option('--unit', 'only run unit tests', false)
  .option('--functional', 'only run functional tests', false)
  .option('-c <jobs>, --concurrency <jobs>', 'set maximum concurrent services being tested', null)
  .option('-s <service>, --service <service>', 'the service for which you want to test', null)
  .action(async (cmd) => {
    await runTests(
      scheduler,
      {
        bootstrap: cmd.bootstrap,
        recompile: cmd.recompile,
        unit: cmd.unit,
        functional: cmd.functional,
        concurrency: cmd.C,
        service: cmd.S,
      },
      logger,
    );
  });

program
  .command('init')
  .description('initialize new project with the CLI wizard')
  .action(async () => {
    logger.log('cmd').error('Not implemented');
  });

program
  .command('new <service-name>')
  .description('initialize a new service with the CLI wizard')
  .action(async (cmd) => {
    logger.log('cmd').debug(cmd);
    logger.log('cmd').error('Not implemented');
  });

(async (): Promise<void> => program.parseAsync(process.argv))();
