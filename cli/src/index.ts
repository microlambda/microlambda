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
  .option('-i, --interactive', 'interactively choose microservices', false)
  .option('-p <port>, --port <port>', 'if not specified in config, start microservices from port', 3001)
  .option('-n, --no-recompile', 'avoid recompiling dependency graph before starting microservices')
  .description('Starts microlambda project')
  .action(async (cmd) => {
    const options = {
      recompile: cmd.recompile,
      defaultPort: cmd.P || 3001,
      interactive: cmd.interactive,
    };
    log.debug(options);
    await start(scheduler, options);
  });

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
(async () => program.parseAsync(process.argv))();
