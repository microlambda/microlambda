/* eslint-disable no-console */
import { beforePackage, IPackageCmd, packageServices } from "./package";
import Spinnies from 'spinnies';
import chalk from 'chalk';
import {prompt} from 'inquirer';
import {ConfigReader, Deployer, DeployEvent, getAccountIAM, IConfig, Logger} from '@microlambda/core';
import {join} from 'path';
import {pathExists, remove} from 'fs-extra';
import { isDaemon, isNodeSucceededEvent, RunCommandEvent, RunCommandEventEnum } from "@centipod/core";
import { spinniesOptions } from "../utils/spinnies";

export interface IDeployCmd extends IPackageCmd {
  e: string;
  prompt: boolean;
  verbose: boolean;
  onlyPrompt: boolean;
}

export const checkEnv = (config: IConfig, cmd: { e: string | null }, msg: string): void => {
  if (!cmd.e) {
    console.error(chalk.red(msg));
    process.exit(1);
  }
  if (config.stages && !config.stages.includes(cmd.e)) {
    console.error(chalk.red('Target stage is not part of allowed stages.'));
    console.error(chalk.red('Allowed stages are:', config.stages));
    process.exit(1);
  }
};

export const getCurrentUserIAM = async (): Promise<string> => {
  return getAccountIAM().catch((err: unknown) => {
    console.error(chalk.red('You are not authenticated to AWS. Please check your keypair or AWS profile.'));
    console.error(chalk.red('Original error: ' + err));
    process.exit(1);
  });
};

export const handleNext = (
  evt: DeployEvent,
  spinnies: Spinnies,
  failures: Set<DeployEvent>,
  actions: Set<DeployEvent>,
  verbose: boolean,
  action: 'deploy' | 'remove',
): void => {
  const key = (service: string, evt: DeployEvent): string => `${service}|${evt.region}`;
  const actionVerbBase = action === 'deploy' ? 'deploy' : 'remov';
  const isTty = process.stdout.isTTY;
  const capitalize = (input: string): string => input.slice(0, 1).toUpperCase() + input.slice(1);
  switch (evt.type) {
    case RunCommandEventEnum.NODE_STARTED:
      if (isTty) {
        spinnies.add(key(evt.workspace.name, evt), {
          text: `${capitalize(actionVerbBase)}ing ${evt.workspace.name} ${chalk.magenta(`[${evt.region}]`)}`,
        });
      } else {
        console.info(`${chalk.bold(evt.workspace.name)} ${actionVerbBase}ing ${chalk.magenta(`[${evt.region}]`)}`);
      }
      break;
    case RunCommandEventEnum.NODE_PROCESSED:
      if (isTty) {
        spinnies.succeed(key(evt.workspace.name, evt), {
          text: `${capitalize(actionVerbBase)}ed ${evt.workspace.name} ${chalk.magenta(`[${evt.region}]`)}`,
        });
      } else {
        console.info(
          `${chalk.bold(evt.workspace.name)} - Successfully ${actionVerbBase}ed ${chalk.magenta(`[${evt.region}]`)}`,
        );
      }
      actions.add(evt);
      break;
    case RunCommandEventEnum.NODE_ERRORED:
      failures.add(evt);
      if (isTty) {
        spinnies.fail(key(evt.workspace.name, evt), {
          text: `Error ${actionVerbBase}ing ${evt.workspace.name} ! ${chalk.magenta(`[${evt.region}]`)}`,
        });
      } else {
        console.info(
          `${chalk.bold(evt.workspace.name)} - ${capitalize(action)} failed ${chalk.magenta(`[${evt.region}]`)}`,
        );
      }
  }
};

export const printReport = async (
  actions: Set<DeployEvent | RunCommandEvent>,
  failures: Set<DeployEvent | RunCommandEvent>,
  total: number,
  action: 'deploy' | 'remove' | 'package',
  verbose = false,
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
    const region = (evt as DeployEvent).region;
    if (region && evt.type !== RunCommandEventEnum.TARGETS_RESOLVED) {
      console.error(
        chalk.bold(chalk.red(`#${i} - Failed to ${action} ${(evt as any).workspace.name} in ${region} region\n`)),
      );
    } else {
      console.error(chalk.bold(chalk.red(`#${i} - Failed to ${action} ${(evt as any).workspace.name}\n`)));
    }

    if ((evt as any).error) {
      console.error(chalk.bold(`#${i} - Error details:`));
      console.error((evt as any).error);
      console.log('');
    }
  }
  console.info(chalk.underline(chalk.bold('▼ Execution summary\n')));
  if (verbose) {
    let i = 0;
    i++;
    for (const action of actions) {
      if ((action as DeployEvent).region && action.type !== RunCommandEventEnum.TARGETS_RESOLVED) {
        console.info(
          chalk.bold(`#${i} - Successfully ${actionVerbBase}ed ${action.workspace.name} in ${(action as DeployEvent).region} region\n`),
        );
      } else if (action.type !== RunCommandEventEnum.TARGETS_RESOLVED) {
        console.info(chalk.bold(`#${i} - Successfully ${actionVerbBase}ed ${(action).workspace.name}\n`));
      }
      if (isNodeSucceededEvent(action)) {
        action.result.commands.forEach((result) => {
          if (!isDaemon(result)) {
            console.info(chalk.grey('> ' + result.command));
            console.info(result.all);
          }
        });
      }
    }
  }
  console.info(`Successfully ${actionVerbBase}ed ${total - failures.size}/${total} stacks`);
  console.info(`Error occurred when ${actionVerbBase}ing ${failures.size} stacks\n`);
  if (failures.size) {
    console.error(chalk.red('Process exited with errors'));
    process.exit(1);
  }
  console.error(chalk.green('Process exited without errors'));
};

export const deploy = async (cmd: IDeployCmd, logger: Logger): Promise<void> => {
  return new Promise(async () => {
    console.info(chalk.underline(chalk.bold('\n▼ Preparing request\n')));
    const reader = new ConfigReader(logger);
    const config = reader.readConfig();
    checkEnv(config, cmd, 'You must provide a target stage to deploy services');
    const currentIAM = await getCurrentUserIAM();

    console.info(chalk.underline(chalk.bold('\n▼ Request summary\n')));
    console.info(chalk.bold('The following services will be deployed'));
    console.info('Stage:', cmd.e);
    console.info('Services:', cmd.s != null ? cmd.s : 'all');
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
    const options = await beforePackage(cmd, logger);

    if(options.force) {
      console.info('\n▼ Clean artifacts directories\n');
      // Cleaning artifact location
      const cleaningSpinnies = new Spinnies(spinniesOptions);
      let hasCleanErrored = false;
      await Promise.all(
        options.targets.map(async (service) => {
          const artefactLocation = join(service.root, '.package');
          const doesExist = await pathExists(artefactLocation);
          if (doesExist) {
            cleaningSpinnies.add(service.name, {
              text: `Cleaning artifact directory ${chalk.grey(artefactLocation)}`,
            });
            try {
              await remove(artefactLocation);
              cleaningSpinnies.succeed(service.name);
            } catch (e) {
              cleaningSpinnies.fail(service.name);
              hasCleanErrored = true;
            }
          }
        }),
      );
      if (hasCleanErrored) {
        console.error(chalk.red('Error cleaning previous artifacts'));
        process.exit(1);
      }
    }

    console.info('\nPackaging services\n');
    const packageResult = await packageServices(options);
    if (packageResult.failures.size) {
      await printReport(packageResult.success, packageResult.failures, options.service ? 1 : options.project.services.size, 'package', false);
      process.exit(1);
    }

    reader.validate(options.project);

    console.info('\n▼ Deploying services\n');

    const spinnies = new Spinnies(spinniesOptions);

    const failures: Set<DeployEvent> = new Set();
    const actions: Set<DeployEvent> = new Set();

    const deployer = new Deployer({
      ...options,
      environment: cmd.e,
    });
    deployer.deploy(options.service).subscribe(
      (evt) => handleNext(evt, spinnies, failures, actions, cmd.verbose, 'deploy'),
      (err) => {
        console.error(chalk.red('Error deploying services'));
        console.error(err);
        process.exit(1);
      },
      async () => {
        await printReport(actions, failures, actions.size, 'deploy', cmd.verbose);
        console.info(`Successfully deploy from ${cmd.e} 🚀`);
        process.exit(0);
      },
    );
  });
};
