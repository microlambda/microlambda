#!/usr/bin/env node
import { Command } from 'commander';

import { start } from './start';
import { RecompilationScheduler } from './utils/scheduler';
import { log } from './utils/logger';
import { tailServiceLogs } from './utils/logs';
import { getProjectRoot } from './utils/get-project-root';
import { SocketsManager } from './ipc/socket';

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
  .description('start microlambda services')
  .action(async (cmd) => {
    const options = {
      recompile: cmd.recompile,
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
    log.debug(cmd);
    tailServiceLogs(cmd);
  });

program
  .command('stop')
  .option('-i, --interactive', 'interactively choose microservices', false)
  .option('-s <service>, --service <service>', 'the service you want to stop', false)
  .description('stop microlambda services')
  .action(async (cmd) => {
    log.debug(cmd);
    log.error('Not implemented');
  });

program
  .command('restart')
  .option('-i, --interactive', 'interactively choose microservices', false)
  .option('-s <service>, --service <service>', 'the service you want to restart', false)
  .description('restart microlambda services')
  .action(async (cmd) => {
    log.debug(cmd);
    log.error('Not implemented');
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
  .action(async (cmd) => {
    log.debug(cmd);
    const projectRoot = getProjectRoot();
    const sockets = new SocketsManager(projectRoot);
    await sockets.subscribeStatus().subscribe((status) => {
      log.info(status);
    });
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
