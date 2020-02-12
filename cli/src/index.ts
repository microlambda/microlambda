#!/usr/bin/env node
import { Command } from 'commander';
import { start } from './start';

const program = new Command();

program.version('0.0.1alpha');

program
  .command('start')
  .description('starts microlambda project')
  .action(async () => {
    await start();
  });

program.parse(process.argv);
