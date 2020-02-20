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
  .option('--interactive, -i', 'interactively choose microservices')
  .option('--port, -p', 'Choose a new port')
  .option('--no-recompile, -nr', 'Avoid recompiling dependency graph before starting microservices')
  .description('Starts microlambda project')
  .action(async (cmd) => {

    const portOption = process.argv.indexOf('-p' || '--port');

    const options = {
      recompile: cmd.recompile,
      defaultPort: portOption !== -1 ? parseInt(process.argv[portOption + 1]) : 3001,
      interactive: !!process.argv.indexOf('-i'),
    };

    log.debug(options);
    await start(scheduler, options);
  });

program.parse(process.argv);
