#!/usr/bin/env node
import { Command } from 'commander';
import { start } from './start';
import { RecompilationScheduler } from './utils/scheduler';

// Recompilation Scheduler must be a singleton
const scheduler = new RecompilationScheduler();

const program = new Command();

program.version('0.0.1alpha');

program
  .command('start')
  .description('starts microlambda project')
  .action(async () => {
    await start(scheduler);
  });

program.parse(process.argv);
