#!/usr/bin/env node
import { Command } from 'commander';
import { start } from './cmd';
import { checkService } from './cmd/check-service';
import { build } from './cmd/build';
import { packagr } from './cmd/package';
import { deploy } from './cmd/deploy';
import { getDefaultThreads } from '@microlambda/utils';
import { remove } from './cmd/remove';
import { generate } from './cmd/generate';
import {info} from "./cmd/info";
import { logs } from "./cmd/logs";
import { init } from './cmd/init';
import { commandWrapper } from './utils/command-wapper';
import { listEnvs } from './cmd/envs/list';
import { createEnv } from './cmd/envs/create';
import { describeEnv } from './cmd/envs/describe';
import { destroyEnv } from './cmd/envs/destroy';
import { createReplicate } from './cmd/envs/create-replicate';
import { destroyReplicate } from './cmd/envs/destroy-replicate';

const program = new Command();

program.version('1.0.0-alpha.2');

program
  .command('init')
  .option('--no-prompt', 'skip asking user confirmation before initializing', false)
  .description('Initialize remote state for current project.')
  .action(async (cmd) => {
    await commandWrapper(async () => {
      await init(cmd);
    })
  });

const envs = program
  .command('envs')
  .description('Manage deployed environments.');

envs
  .command('list')
  .description('List environments deployed in current AWS subscription.')
  .action(async () => {
    await commandWrapper(async () => {
      await listEnvs();
    })
  });

envs
  .command('create <name>')
  .description('Create a new environment un current AWS subscription.')
  .action(async (cmd) => {
    await commandWrapper(async () => {
      await createEnv(cmd);
    })
  });

envs
  .command('describe <name>')
  .description('Print details of an exiting environments.')
  .action(async (cmd) => {
    await commandWrapper(async () => {
      await describeEnv(cmd);
    })
  });

envs
  .command('destroy <name>')
  .description('Remove an existing deployed environment from AWS. This will destroy all microservices in every region for this environment.')
  .action(async (cmd) => {
    await commandWrapper(async () => {
      await destroyEnv(cmd);
    })
  });

envs
  .command('create-replicate <name> <region>')
  .description('Remove an existing deployed environment from AWS. This will destroy all microservices in every region for this environment.')
  .action(async (name, region) => {
    await commandWrapper(async () => {
     await createReplicate(name, region);
    })
  });

envs
  .command('destroy-replicate <name> <region>')
  .description('Remove an existing deployed environment from AWS. This will destroy all microservices in every region for this environment.')
  .action(async (name, region) => {
    await commandWrapper(async () => {
      await destroyReplicate(name, region);
    })
  });

// FIXME
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
          service: cmd.s,
          port: cmd.P || 4545,
          interactive: cmd.interactive,
        };
        await start(cmd);
      }, true),
  );

/*
// TODO: IPC and background mode
program
  .command('logs')
  .requiredOption('-s <service>, --service <service>', 'the service for which you want to see logs', false)
  .description('print service logs')
  .action(async (cmd) => {
    await logs(cmd, eventsLog, scheduler);
  });*/

program
  .command('logs <service> [command]')
  .description('print service logs')
  .action(async (service, command) => {
    await logs(service, command);
  });

program
  .command('service <service> describe')
  .description('check if service is valid')
  .action(
    async (cmd) =>
      await commandWrapper(async () => {
        // TODO
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
    await stop(scheduler, cmd.s);
  });

program
  .command('restart')
  .option('-i, --interactive', 'interactively choose microservices', false)
  .option('-s <service>, --service <service>', 'the service you want to restart', false)
  .description('restart microlambda services')
  .action(async (cmd) => {
    await restart(scheduler, cmd.s);
  });
*/

program
  .command('info')
  .option('--graph', 'print dependencies graph', false)
  .option('--roots', 'show project roots', false)
  .option('--leaves', 'show project leaves', false)
  .option('-s <service>, --service <service>', 'display information on a given workspace', false)
  .description('print current project information')
  .action(
    async (cmd) =>
      await commandWrapper(async () => {
        await info(cmd);
      }),
  );

// TODO: Watch option
program
  .command('build')
  .option('--install', 'skip bootstrapping dependencies', false)
  .option('--only', 'skip compiling service dependencies', false)
  .option('-s <service>, --service <service>', 'the service you want to build', '')
  .option('--affected <rev1..rev2>', 'only rebuild services affected between two revisions', '')
  .option('--force', 'skip compiling service dependencies', false)
  .description('compile packages and services')
  .action(
    async (cmd) =>
      await commandWrapper(async () => {
        await build(cmd);
      }),
  );

// TODO: From cache info
program
  .command('package')
  .option('-v, --verbose', 'print package commands output', false)
  .option('--no-bootstrap', 'skip bootstrapping dependencies', false)
  .option('--no-recompile', 'skip package and service recompilation', false)
  .option('-c, --concurrency', 'defines how much threads can be used for parallel tasks', getDefaultThreads().toString())
  .option('-s <service>, --service <service>', 'the service you want to package', false)
  .description('package services source code')
  .action(
    async (cmd) =>
      await commandWrapper(async () => {
        await packagr(cmd);
      }),
  );

// FIXME
program
  .command('deploy')
  // .option('-i, --interactive', 'interactively choose microservices', false)
  .option('--verbose', 'print child processes stdout and stderr', false)
  .option('--force', 'ignore checksum and re-deploy', false)
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
        await deploy(cmd);
      }, true),
  );

// FIXME
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
        await remove(cmd);
      }),
  );

// FIXME
program
  .command('test')
  .description('test microlambda services')
  .option('--no-bootstrap', 'skip reinstalling dependencies before starting microservices', false)
  .option('--no-recompile', 'skip recompiling dependency graph before starting microservices', false)
  .option('--remote-cache', 'skip recompiling dependency graph before starting microservices', false)
  .option('--branch', 'skip recompiling dependency graph before starting microservices', false)
  .option('--affected-since', 'skip recompiling dependency graph before starting microservices', false)
  .option('--only-self', 'only recompile target services', false)
  .option('--unit', 'only run unit tests', false)
  .option('--functional', 'only run functional tests', false)
  .option('--stdio <stdio>', 'whether to print or not test command stdout', 'ignore')
  .option('-c <jobs>, --concurrency <jobs>', 'set maximum concurrent services being tested')
  .option('-s <service>, --service <service>', 'the service for which you want to test')
  .action(
    async () =>
      await commandWrapper(async () => {
        //await runTests(cmd, scheduler, eventsLog);
      }),
  );

program
  .command('generate [blueprint]')
  .description('generate code from a blueprint')
  .action(
    async (blueprint: string) =>
      await commandWrapper(async () => {
        await generate(blueprint);
      }),
  );

(async (): Promise<Command> => program.parseAsync(process.argv))();
