#!/usr/bin/env node
import { Command } from 'commander';
import { start } from './start';
import { RecompilationScheduler } from './utils/scheduler';
import { log } from './utils/logger';

// Recompilation Scheduler must be a singleton
const scheduler = new RecompilationScheduler();

const program = new Command();

program.version('0.0.1alpha');

program
  .command('start')
  .option('-i', 'interactively choose microservices')
  .option('--no-recompile', 'avoid recompiling dependency graph before starting microservices')
  .description('starts microlambda project')
  .action(async (cmd) => {
    log.debug({
      recompile: cmd.recompile,
      defaultPort: 3001, // TODO: Add a --port option
      interactive: false,  // TODO: Add a -i option
    });
    await start(scheduler, {
      recompile: cmd.recompile,
      defaultPort: 3001, // TODO: Add a --port option
      interactive: false,  // TODO: Add a -i option
    });
  });

program.parse(process.argv);
