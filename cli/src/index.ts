#!/usr/bin/env node
/* eslint-disable no-console */
import { Command } from 'commander';
import { start } from './cmd';
import { checkStage } from './cmd/check-stage';
import { checkService } from './cmd/check-service';
import { build } from './cmd/build';
import chalk from 'chalk';
import { packagr } from './cmd/package';
import { deploy } from './cmd/deploy';
import { getDefaultThreads, Logger } from '@microlambda/core';
import { remove } from './cmd/remove';
import { generate } from './cmd/generate';

// Logger must be a singleton
const logger = new Logger();

const program = new Command();

program.version('0.2.3-alpha');

const commandWrapper = async (fn: () => Promise<void> | void, keepOpen = false): Promise<void> => {
  try {
    await fn();
    if (!keepOpen) {
      process.exit(0);
    }
  } catch (e) {
    console.error(chalk.bgRedBright('Uncaught error:'));
    console.error(e);
    process.exit(1);
  }
};

program
  .command('start')
  .option('-i, --interactive', 'interactively choose microservices', false)
  .option('-d, --discrete', 'start the app in background without logging in console', false)
  .option('-p <port>, --port <port>', 'start mila server on given port', '4545')
  .option('-n, --no-recompile', 'avoid recompiling dependency graph before starting microservices')
  .option('-s <service>, --service <service>', 'the service for which you want to start', false)
  .description('start microlambda services')
  .action(
    async (cmd) =>
      await commandWrapper(async () => {
        const options = {
          recompile: cmd.recompile,
          service: cmd.S,
          port: cmd.P || 4545,
          interactive: cmd.interactive,
        };
        logger.log('cmd').debug(options);
        await start();
      }, true),
  );

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
  .action(
    async (cmd) =>
      await commandWrapper(async () => {
        await checkStage(cmd);
      }),
  );

program
  .command('check-service <service>')
  .description('check if service is valid')
  .action(
    async (cmd) =>
      await commandWrapper(async () => {
        await checkService(cmd);
      }),
  );

/*
// TODO: IPC and background mode
// See   https://stackoverflow.com/questions/12871740/how-to-detach-a-spawned-child-process-in-a-node-js-script
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
  .option('--no-bootstrap', 'skip bootstrapping dependencies', false)
  .option('--only-self', 'skip compiling service dependencies', false)
  .option('-s <service>, --service <service>', 'the service you want to build', false)
  .description('compile packages and services')
  .action(
    async (cmd) =>
      await commandWrapper(async () => {
        await build(cmd, logger);
      }),
  );

program
  .command('package')
  // .option('-i, --interactive', 'interactively choose microservices', false)
  .option('--no-bootstrap', 'skip bootstrapping dependencies', false)
  .option('--no-recompile', 'skip package and service recompilation', false)
  .option('-c, --concurrency', 'defines how much threads can be used for parallel tasks', getDefaultThreads().toString())
  .option('-s <service>, --service <service>', 'the service you want to package', false)
  .description('package services source code')
  .action(
    async (cmd) =>
      await commandWrapper(async () => {
        await packagr(cmd, logger);
      }),
  );

program
  .command('deploy')
  // .option('-i, --interactive', 'interactively choose microservices', false)
  .option('--verbose', 'print child processes stdout and stderr', false)
  .option('--no-bootstrap', 'skip bootstrapping dependencies', false)
  .option('--no-recompile', 'skip package and service recompilation', false)
  .option('-c, --concurrency', 'defines how much threads can be used for parallel tasks', getDefaultThreads().toString())
  .option('--no-package', 'skip bundling service deployment package', false)
  .option('-s <service>, --service <service>', 'the service you want to deploy')
  .option('-e <stage>, --stage <stage>', 'target stage for deployment')
  .option('--no-prompt', 'skip asking user confirmation before deploying', false)
  .option('--only-prompt', 'only display deployment information and return', false)
  .description('deploy services to AWS')
  .action(
    async (cmd) =>
      await commandWrapper(async () => {
        await deploy(cmd, logger);
      }),
  );

program
  .command('remove')
  .requiredOption('-e <stage>, --stage <stage>', 'target stage for deletion')
  .option(
    '-s <service>, --service <service>',
    'the service you want to remove. If no specified all services will be removed.',
  )
  .option('-c, --concurrency', 'defines how much threads can be used for parallel tasks', getDefaultThreads().toString())
  .option('--no-prompt', 'skip asking user confirmation before deploying', false)
  .option('--only-prompt', 'only display deployment information and return', false)
  .option('--verbose', 'print child processes stdout and stderr', false)
  .description('remove services from AWS')
  .action(
    async (cmd) =>
      await commandWrapper(async () => {
        await remove(cmd, logger);
      }),
  );

program
  .command('test')
  .description('test microlambda services')
  .option('--no-bootstrap', 'skip reinstalling dependencies before starting microservices', false)
  .option('--no-recompile', 'skip recompiling dependency graph before starting microservices', false)
  .option('--only-self', 'only recompile target services', false)
  .option('--unit', 'only run unit tests', false)
  .option('--functional', 'only run functional tests', false)
  .option('--stdio <stdio>', 'whether to print or not test command stdout', 'ignore')
  .option('-c <jobs>, --concurrency <jobs>', 'set maximum concurrent services being tested')
  .option('-s <service>, --service <service>', 'the service for which you want to test')
  .action(
    async (cmd) =>
      await commandWrapper(async () => {
        //await runTests(cmd, scheduler, logger);
      }),
  );

program
  .command('generate [blueprint]')
  .description('generate code from a blueprint')
  .action(
    async (blueprint: string) =>
      await commandWrapper(async () => {
        await generate(blueprint, logger);
      }),
  );

/*

// TODO: Generator
program
  .command('init')
  .description('initialize new project with the CLI wizard')
  .action(async () => {
    logger.log('cmd').error('Not implemented');
  });
*/

(async (): Promise<Command> => program.parseAsync(process.argv))();
