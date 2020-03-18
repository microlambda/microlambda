#!/usr/bin/env node
import { Command } from 'commander';
import { RecompilationScheduler } from './utils/scheduler';
import { log } from './utils/logger';
import { start, stop } from './cmd';
import { status } from './cmd/status';
import { restart } from './cmd/restart';
import { logs } from './cmd/logs';

// Recompilation Scheduler must be a singleton
const scheduler = new RecompilationScheduler();

const program = new Command();

program.version('0.0.1alpha');

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
    log.debug(options);
    await start(scheduler, options);
  });

program
  .command('logs')
  .requiredOption('-s <service>, --service <service>', 'the service for which you want to see logs', false)
  .description('print service logs')
  .action(async (cmd) => {
    await logs(cmd);
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
    log.debug(cmd);
    log.error('Not implemented');
  });

program
  .command('deploy')
  .option('-i, --interactive', 'interactively choose microservices', false)
  .option('-s <service>, --service <service>', 'the service you want to deploy', false)
  .description('deploy services to AWS')
  .action(async (cmd) => {
    log.debug(cmd);
    log.error('Not implemented');
  });

program
  .command('status')
  .description('see the microservices status')
  .action(async () => {
    await status(scheduler);
  });

program
  .command('init')
  .description('initialize new project with the CLI wizard')
  .action(async () => {
    log.error('Not implemented');
  });

program
  .command('new <service-name>')
  .description('initialize a new service with the CLI wizard')
  .action(async (cmd) => {
    log.debug(cmd);
    log.error('Not implemented');
  });

(async (): Promise<void> => program.parseAsync(process.argv))();
