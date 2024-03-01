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
import { info } from './cmd/info';
import { logs } from './cmd/logs';
import { init } from './cmd/init';
import { commandWrapper } from './utils/command-wapper';
import { listEnvs } from './cmd/envs/list';
import { createEnv } from './cmd/envs/create';
import { describeEnv } from './cmd/envs/describe';
import { destroyEnv } from './cmd/envs/destroy';
import { createReplicate } from './cmd/envs/create-replicate';
import { destroyReplicate } from './cmd/envs/destroy-replicate';
import { runTests } from './cmd/run-tests';
import { releaseLock } from '@microlambda/core';
import { logger } from './utils/logger';

const program = new Command();

program.version('1.0.0-alpha.3');

program
  .command('init')
  .option('--no-prompt', 'skip asking user confirmation before initializing', false)
  .description('Initialize remote state for current project.')
  .action(async (cmd) => {
    await commandWrapper(async () => {
      await init(cmd);
    });
  });

const envs = program.command('envs').description('Manage deployed environments.');

envs
  .command('list')
  .description('List environments deployed in current AWS subscription.')
  .action(async () => {
    await commandWrapper(async () => {
      await listEnvs();
    });
  });

envs
  .command('create <name>')
  .description('Create a new environment un current AWS subscription.')
  .action(async (cmd) => {
    await commandWrapper(async () => {
      await createEnv(cmd);
    });
  });

envs
  .command('describe <name>')
  .description('Print details of an exiting environments.')
  .action(async (cmd) => {
    await commandWrapper(async () => {
      await describeEnv(cmd);
    });
  });

envs
  .command('destroy <name>')
  .option('--verbose', 'print child processes stdout and stderr', false)
  .option('--no-prompt', 'skip asking user confirmation before deploying', true)
  .option('--skip-lock', 'ignore lock and perform the actions anyway', false)
  .option('--only-prompt', 'only display deployment information and return', false)
  .option('-c <jobs>, --concurrency <jobs>', 'set maximum concurrent services being removed')
  .option('--no-destroy', 'only patch state without removing existing services', true)
  .description(
    'Remove an existing deployed environment from AWS. This will destroy all microservices in every region for this environment.',
  )
  .action(async (env, cmd) => {
    await commandWrapper(async () => {
      await destroyEnv(env, cmd);
    });
  });

envs
  .command('create-replicate <name> <region>')
  .description(
    'Remove an existing deployed environment from AWS. This will destroy all microservices in every region for this environment.',
  )
  .option('--verbose', 'print child processes stdout and stderr', false)
  .option('--no-deploy', 'only patch state without deploying/removing services', true)
  .option('--no-install', 'skip installing dependencies', true)
  .option('--no-recompile', 'skip package and service recompilation', true)
  .option('--no-package', 'skip bundling service deployment package', true)
  .option('--force-deploy', 'ignore deploy command checksums and re-deploy', false)
  .option('--force-package', 'ignore package and deploy commands checksums and re-deploy', false)
  .option('--force', 'ignore build, package and deploy checksums and re-deploy', false)
  .option(
    '-c, --concurrency',
    'defines how much threads can be used for parallel tasks',
    getDefaultThreads().toString(),
  )
  .option('--no-prompt', 'skip asking user confirmation before deploying', true)
  .option('--skip-lock', 'ignore lock and perform the actions anyway', false)
  .option('--only-prompt', 'only display deployment information and return', false)
  .action(async (name, region, cmd) => {
    await commandWrapper(async () => {
      await createReplicate(name, region, cmd);
    });
  });

envs
  .command('destroy-replicate <name> <region>')
  .option('--verbose', 'print child processes stdout and stderr', false)
  .option('--no-deploy', 'only patch state without deploying/removing services', true)
  .option('--no-install', 'skip installing dependencies', true)
  .option('--no-recompile', 'skip package and service recompilation', true)
  .option('--no-package', 'skip bundling service deployment package', true)
  .option('--force-deploy', 'ignore deploy command checksums and re-deploy', false)
  .option('--force-package', 'ignore package and deploy commands checksums and re-deploy', false)
  .option('--force', 'ignore build, package and deploy checksums and re-deploy', false)
  .option(
    '-c, --concurrency',
    'defines how much threads can be used for parallel tasks',
    getDefaultThreads().toString(),
  )
  .option('--no-prompt', 'skip asking user confirmation before deploying', true)
  .option('--skip-lock', 'ignore lock and perform the actions anyway', false)
  .option('--only-prompt', 'only display deployment information and return', false)
  .description(
    'Remove an existing deployed environment from AWS. This will destroy all microservices in every region for this environment.',
  )
  .action(async (name, region, cmd) => {
    await commandWrapper(async () => {
      await destroyReplicate(name, region, cmd);
    });
  });

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
  .description('print information about a given service')
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
  .option('--verbose', 'print build commands output', false)
  .option('--no-install', 'skip bootstrapping dependencies', false)
  .option('-s <service>, --service <service>', 'the service you want to build', '')
  .option('-c <jobs>, --concurrency <jobs>', 'set maximum concurrent services being tested')
  .option('--force', 'ignore build command checksums and re-package', false)
  .description('compile packages and services')
  .action(
    async (cmd) =>
      await commandWrapper(async () => {
        await build(cmd);
      }),
  );

// FIXME
program
  .command('test')
  .description('test microlambda services')
  .option('--verbose', 'print child processes stdout and stderr', false)
  .option('--no-install', 'skip reinstalling dependencies before running tests', false)
  .option('-s <service>, --service <service>', 'the services to test (coma-seperated list)')
  .option('--force', 'ignore test command checksums and re-run tests', false)
  .option('--remote-cache', 'use remote caching to skip tests execution if sources did not change', false)
  .option(
    '--affected-since <sha1>',
    'specify a revision as reference when using remote caching. This is optional, if not specified, last execution on current branch will be used',
  )
  .option('-c <jobs>, --concurrency <jobs>', 'set maximum concurrent services being tested')
  .action(
    async (cmd) =>
      await commandWrapper(async () => {
        await runTests(cmd);
      }),
  );

program
  .command('package')
  .requiredOption('-e <stage>, --stage <stage>', 'target stage for deployment')
  .option('--verbose', 'print package commands output', false)
  .option('--no-install', 'skip installing dependencies', false)
  .option('--no-recompile', 'skip workspaces recompilation', false)
  .option('--force-package', 'ignore package command checksums and re-package', false)
  .option('--force', 'skip bootstrapping dependencies', false)
  .option(
    '-c, --concurrency',
    'defines how much threads can be used for parallel tasks',
    getDefaultThreads().toString(),
  )
  .option('-s <service>, --service <service>', 'the services you want to package (coma-seperated list)', false)
  .description('package services source code')
  .action(
    async (cmd) =>
      await commandWrapper(async () => {
        await packagr(cmd);
      }),
  );

program
  .command('deploy')
  .requiredOption('-e <stage>, --stage <stage>', 'target stage for deployment')
  .option('--verbose', 'print child processes stdout and stderr', false)
  .option('--no-install', 'skip installing dependencies', true)
  .option('--no-recompile', 'skip package and service recompilation', true)
  .option('--no-package', 'skip bundling service deployment package', true)
  .option('--force-deploy', 'ignore deploy command checksums and re-deploy', false)
  .option('--force-package', 'ignore package and deploy commands checksums and re-deploy', false)
  .option('--force', 'ignore build, package and deploy checksums and re-deploy', false)
  .option(
    '-c, --concurrency',
    'defines how much threads can be used for parallel tasks',
    getDefaultThreads().toString(),
  )
  .option('-s <service>, --service <service>', 'the services you want to deploy (coma-seperated list)')
  .option('--no-prompt', 'skip asking user confirmation before deploying', true)
  .option('--skip-lock', 'ignore lock and perform the actions anyway', false)
  .option('--only-prompt', 'only display deployment information and return', false)
  .description('deploy services to AWS')
  .action(
    async (cmd) =>
      await commandWrapper(async () => {
        await deploy(cmd);
      }, true),
  );

program
  .command('remove')
  .requiredOption('-e <stage>, --stage <stage>', 'target stage for deletion')
  .option(
    '-s <service>, --service <service>',
    'the service you want to remove. If no specified all services will be removed.',
  )
  .option(
    '-c, --concurrency',
    'defines how much threads can be used for parallel tasks',
    getDefaultThreads().toString(),
  )
  .option('--no-prompt', 'skip asking user confirmation before deploying', true)
  .option('--only-prompt', 'only display deployment information and return', false)
  .option('--verbose', 'print child processes stdout and stderr', false)
  .description('remove services from AWS')
  .action(
    async (cmd) =>
      await commandWrapper(async () => {
        await remove(cmd);
      }, true),
  );

program
  .command('release-lock')
  .requiredOption('-e <stage>, --stage <stage>', 'target stage for deletion')
  .option(
    '-s <service>, --service <service>',
    'the service you want to unlock. If no specified all locks will be removed for the given environment.',
  )
  .description('Release lock for a given environment')
  .action(
    async (cmd) =>
      await commandWrapper(async () => {
        await releaseLock(cmd.e, cmd.s, logger);
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
