/* eslint-disable no-console */
import { beforePackage, IPackageCmd, packageServices } from './package';
import Spinnies from 'spinnies';
import chalk from 'chalk';
import { prompt } from 'inquirer';
import {
  ConfigReader,
  RecompilationScheduler,
  Logger,
  Service,
  getAccountIAM,
  IConfig,
  IPackageEvent,
} from '@microlambda/core';
import { IDeployEvent } from '@microlambda/core/lib';
import { join } from 'path';
import { pathExists, remove } from 'fs-extra';

export interface IDeployCmd extends IPackageCmd {
  E: string;
  prompt: boolean;
  verbose: boolean;
  onlyPrompt: boolean;
}

export const checkEnv = (config: IConfig, cmd: { E: string | null }, msg: string): void => {
  if (!cmd.E) {
    console.error(chalk.red(msg));
    process.exit(1);
  }
  if (config.stages && !config.stages.includes(cmd.E)) {
    console.error(chalk.red('Target stage is not part of allowed stages.'));
    console.error(chalk.red('Allowed stages are:', config.stages));
    process.exit(1);
  }
};

export const getCurrentUserIAM = async (): Promise<string> => {
  return getAccountIAM().catch((err) => {
    console.error(chalk.red('You are not authenticated to AWS. Please check your keypair or AWS profile.'));
    console.error(chalk.red('Original error: ' + err));
    process.exit(1);
  });
};

export const handleNext = (
  evt: IDeployEvent,
  spinnies: Spinnies,
  failures: Set<IDeployEvent>,
  actions: Set<IDeployEvent>,
  verbose: boolean,
  action: 'deploy' | 'remove',
): void => {
  const key = (evt: IDeployEvent): string => `${evt.service.getName()}|${evt.region}`;
  const actionVerbBase = action === 'deploy' ? 'deploy' : 'remov';
  const tty = process.stdout.isTTY;
  const capitalize = (input: string): string => input.slice(0, 1).toUpperCase() + input.slice(1);
  switch (evt.type) {
    case 'started':
      if (tty) {
        spinnies.add(key(evt), {
          text: `${capitalize(actionVerbBase)}ing ${evt.service.getName()} ${chalk.magenta(`[${evt.region}]`)}`,
        });
      } else {
        console.info(`${chalk.bold(evt.service.getName())} ${actionVerbBase}ing ${chalk.magenta(`[${evt.region}]`)}`);
      }
      actions.add(evt);
      break;
    case 'succeeded':
      if (tty) {
        spinnies.succeed(key(evt), {
          text: `${capitalize(actionVerbBase)}ed ${evt.service.getName()} ${chalk.magenta(`[${evt.region}]`)}`,
        });
      } else {
        console.info(
          `${chalk.bold(evt.service.getName())} - Successfully ${actionVerbBase}ed ${chalk.magenta(`[${evt.region}]`)}`,
        );
      }
      break;
    case 'failed':
      failures.add(evt);
      if (tty) {
        spinnies.fail(key(evt), {
          text: `Error ${actionVerbBase}ing ${evt.service.getName()} ! ${chalk.magenta(`[${evt.region}]`)}`,
        });
      } else {
        console.info(
          `${chalk.bold(evt.service.getName())} - ${capitalize(action)} failed ${chalk.magenta(`[${evt.region}]`)}`,
        );
      }
  }
  const regionalDeployLogs = evt.service.logs.deploy[evt.region];
  if (verbose && regionalDeployLogs) {
    console.log(regionalDeployLogs.join(''));
  } else if (verbose) {
    console.warn(chalk.yellow('Cannot print deploy logs'));
  }
};

export const printReport = async (
  failures: Set<IDeployEvent | IPackageEvent>,
  total: number,
  action: 'deploy' | 'remove' | 'package',
): Promise<void> => {
  if (failures.size) {
    console.error(chalk.underline(chalk.bold('\n▼ Error summary\n')));
  }
  const getActionVerbBase = (action: 'deploy' | 'remove' | 'package'): string => {
    switch (action) {
      case 'remove':
        return 'remov';
      case 'package':
        return 'packag';
      default:
        return action;
    }
  };
  const actionVerbBase = getActionVerbBase(action);
  let i = 0;
  for (const evt of failures) {
    i++;
    const region = (evt as IDeployEvent).region;
    if (region) {
      console.error(
        chalk.bold(chalk.red(`#${i} - Failed to ${action} ${evt.service.getName()} in ${region} region\n`)),
      );
    } else {
      console.error(chalk.bold(chalk.red(`#${i} - Failed to ${action} ${evt.service.getName()}\n`)));
    }

    if (evt.error) {
      console.error(chalk.bold(`#${i} - Error details:`));
      console.error(evt.error);
      console.log('');
    }
    const regionalDeployLogs = evt.service.logs[action][region];
    if (regionalDeployLogs) {
      console.error(chalk.bold(`#${i} - Execution logs:`));
      console.log(regionalDeployLogs.join(''));
      console.log('');
      // wait a bit otherwise console do not have time to print message
      await new Promise<void>((resolve) => setTimeout(() => resolve(), 300));
    }
  }
  console.info(chalk.underline(chalk.bold('▼ Execution summary\n')));
  console.info(`Successfully ${actionVerbBase}ed ${total - failures.size}/${total} stacks`);
  console.info(`Error occurred when ${actionVerbBase}ing ${failures.size} stacks\n`);
  if (failures.size) {
    console.error(chalk.red('Process exited with errors'));
    process.exit(1);
  }
  console.error(chalk.green('Process exited without errors'));
};

export const deploy = async (cmd: IDeployCmd, logger: Logger, scheduler: RecompilationScheduler): Promise<void> => {
  return new Promise(async () => {
    console.info(chalk.underline(chalk.bold('\n▼ Preparing request\n')));
    const reader = new ConfigReader(logger);
    const config = reader.readConfig();
    checkEnv(config, cmd, 'You must provide a target stage to deploy services');
    const currentIAM = await getCurrentUserIAM();

    console.info(chalk.underline(chalk.bold('\n▼ Request summary\n')));
    console.info(chalk.bold('The following services will be deployed'));
    console.info('Stage:', cmd.E);
    console.info('Services:', cmd.S != null ? cmd.S : 'all');
    console.info('As:', currentIAM);

    if (cmd.onlyPrompt) {
      process.exit(0);
    }

    if (cmd.prompt) {
      const answers = await prompt([
        {
          type: 'confirm',
          name: 'ok',
          message: 'Are you sure you want to execute this deployment',
        },
      ]);
      if (!answers.ok) {
        process.exit(0);
      }
    }
    const { graph, services } = await beforePackage(cmd, scheduler, logger);
    reader.validate(graph);

    console.info('\n▼ Packaging services\n');

    // TODO: Move this in core wih an option clean: boolean, so that package cmd can clean or not with option
    // Cleaning artifact location
    const cleaningSpinnies = new Spinnies({
      failColor: 'white',
      succeedColor: 'white',
      spinnerColor: 'cyan',
    });
    let hasCleanErrored = false;
    await Promise.all(
      services.map(async (service) => {
        const artefactLocation = join(service.getLocation(), '.package');
        const exists = await pathExists(artefactLocation);
        if (exists) {
          cleaningSpinnies.add(service.getName(), {
            text: `Cleaning artifact directory ${chalk.grey(artefactLocation)}`,
          });
          try {
            await remove(artefactLocation);
            cleaningSpinnies.succeed(service.getName());
          } catch (e) {
            cleaningSpinnies.fail(service.getName());
            hasCleanErrored = true;
          }
        }
      }),
    );
    if (hasCleanErrored) {
      console.error(chalk.red('Error cleaning previous artifacts'));
      process.exit(1);
    }

    const packageFailures = await packageServices(scheduler, cmd.C, services);
    if (packageFailures.size) {
      await printReport(packageFailures, services.length, 'package');
      process.exit(1);
    }

    console.info('\n▼ Deploying services\n');

    const spinnies = new Spinnies({
      failColor: 'white',
      succeedColor: 'white',
      spinnerColor: 'cyan',
    });

    if (cmd.C) {
      scheduler.setConcurrency(cmd.C);
    }
    const failures: Set<IDeployEvent> = new Set();
    const actions: Set<IDeployEvent> = new Set();

    scheduler.deploy(services, cmd.E).subscribe(
      (evt) => {
        handleNext(evt, spinnies, failures, actions, cmd.verbose, 'deploy');
      },
      (err) => {
        console.error(chalk.red('Error deploying services'));
        console.error(err);
        process.exit(1);
      },
      async () => {
        await printReport(failures, actions.size, 'deploy');
        console.info(`Successfully deployed to ${cmd.E} :rocket:`);
        process.exit(0);
      },
    );
  });
};
