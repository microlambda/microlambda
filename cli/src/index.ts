#!/usr/bin/env node
import { Command } from 'commander';
import { RecompilationScheduler } from './utils/scheduler';
import { start, stop } from './cmd';
import { Logger } from './utils/logger';
import { checkStage } from './cmd/check-stage';
import { checkService } from './cmd/check-service';
import { build } from './cmd/build';
import chalk from 'chalk';
import { getDefaultThreads } from './utils/platform';
import { packagr } from './cmd/package';

// Logger must be a singleton
const logger = new Logger();
// Recompilation Scheduler must be a singleton
const scheduler = new RecompilationScheduler(logger);

const program = new Command();

program.version('0.1.0-alpha');

program
  .command('start')
  .option('-i, --interactive', 'interactively choose microservices', false)
  .option('-d, --discrete', 'start the app in background without logging in console', false)
  .option('-p <port>, --port <port>', 'start mila server on given port', 4545)
  .option('-n, --no-recompile', 'avoid recompiling dependency graph before starting microservices')
  .option('-s <service>, --service <service>', 'the service for which you want to start', false)
  .description('start microlambda services')
  .action(async (cmd) => {
    try {
      const options = {
        recompile: cmd.recompile,
        service: cmd.S,
        defaultPort: cmd.P || 3001,
        interactive: cmd.interactive,
      };
      logger.log('cmd').debug(options);
      await start(scheduler, options, logger);
    } catch (e) {
      console.error(`\n${chalk.bgRedBright('Fatal Error')}`, e);
      process.exit(1);
    }
  });

/*
// TODO: IPC and background mode
program
  .command('logs')
  .requiredOption('-s <service>, --service <service>', 'the service for which you want to see logs', false)
  .description('print service logs')
  .action(async (cmd) => {
    await logs(cmd, logger, scheduler);
  });*/

program
  .command('check-stage <stage>')
  .description('check if stage is allowed')
  .action(async (cmd) => {
    try {
      await checkStage(cmd);
    } catch (e) {
      console.error(`\n${chalk.bgRedBright('Fatal Error')}`, e);
      process.exit(1);
    }
  });

program
  .command('check-service <service>')
  .description('check if service is valid')
  .action(async (cmd) => {
    try {
      await checkService(cmd);
    } catch (e) {
      console.error(`\n${chalk.bgRedBright('Fatal Error')}`, e);
      process.exit(1);
    }
  });

/*
// TODO: IPC and background mode
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
*/

program
  .command('build')
  // .option('-i, --interactive', 'interactively choose microservices', false)
  .option( '--no-bootstrap', 'skip bootstrapping dependencies', false)
  .option( '--only-self', 'skip compiling service dependencies', false)
  .option('-s <service>, --service <service>', 'the service you want to build', false)
  .description('compile packages and services')
  .action(async (cmd) => {
    try {
      await build(cmd, scheduler, logger);
    } catch (e) {
      console.error(`\n${chalk.bgRedBright('Fatal Error')}`, e);
      process.exit(1);
    }
  });

program
  .command('package')
  // .option('-i, --interactive', 'interactively choose microservices', false)
  .option( '--no-bootstrap', 'skip bootstrapping dependencies', false)
  .option( '--no-recompile', 'skip package and service recompilation', false)
  .option( '-c, --concurrency', 'defines how much threads can be used for parallel tasks', getDefaultThreads())
  .option('-s <service>, --service <service>', 'the service you want to package', false)
  .description('package services source code')
  .action(async (cmd) => {
    await packagr(cmd, logger, scheduler);
  });

program
  .command('deploy')
  // .option('-i, --interactive', 'interactively choose microservices', false)
  .option( '--no-bootstrap', 'skip bootstrapping dependencies', false)
  .option( '--no-recompile', 'skip package and service recompilation', false)
  .option( '-c, --concurrency', 'defines how much threads can be used for parallel tasks', getDefaultThreads())
  .option( '--no-package', 'skip bundling service deployment package', false)
  .option('-s <service>, --service <service>', 'the service you want to deploy', false)
  .description('deploy services to AWS')
  .action(async (cmd) => {
  });

/*
// TODO: IPC and background mode
program
  .command('status')
  .description('see the microservices status')
  .action(async () => {
    await status(scheduler, logger);
  });
*/

/*
// TODO: Test runner
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
*/

/*
// TODO: Generator
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
*/

(async (): Promise<void> => program.parseAsync(process.argv))();
