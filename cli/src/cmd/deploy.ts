import { beforePackage, IPackageCmd, packageServices } from "./package";
import Spinnies from 'spinnies';
import chalk from 'chalk';
import {prompt} from 'inquirer';
import {ConfigReader, Deployer, DeployEvent, IConfig} from '@microlambda/core';
import {join} from 'path';
import {pathExists, remove} from 'fs-extra';
import { isDaemon, isNodeSucceededEvent, RunCommandEvent, RunCommandEventEnum } from "@microlambda/runner-core";
import { spinniesOptions } from "../utils/spinnies";
import { EventsLog, EventLogsFileHandler } from "@microlambda/logger";
import { aws } from "@microlambda/aws";
import { logger } from '../utils/logger';
import { resolveProjectRoot } from '@microlambda/utils';
import { printAccountInfos } from './envs/list';
import { Environments } from '@microlambda/remote-state';
import { init } from '../utils/init';
import { config } from '@microlambda/handling';

export interface IDeployCmd extends IPackageCmd {
  e: string;
  prompt: boolean;
  verbose: boolean;
  onlyPrompt: boolean;
}

export const checkEnv = (config: IConfig, cmd: { e: string | null }, msg: string): void => {
  if (!cmd.e) {
    logger.error(chalk.red(msg));
    process.exit(1);
  }
  if (config.stages && !config.stages.includes(cmd.e)) {
    logger.error(chalk.red('Target stage is not part of allowed stages.'));
    logger.error(chalk.red('Allowed stages are:', config.stages));
    process.exit(1);
  }
};

export const getCurrentUserIAM = async (): Promise<string> => {
  const user = await aws.iam.getCurrentUser(process.env.AWS_REGION || 'eu-west-1').catch((err: unknown) => {
    logger.error(chalk.red('You are not authenticated to AWS. Please check your keypair or AWS profile.'));
    logger.error(chalk.red('Original error: ' + err));
    process.exit(1);
  });
  return user.arn;
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
        logger.info(`${chalk.bold(evt.workspace.name)} ${actionVerbBase}ing ${chalk.magenta(`[${evt.region}]`)}`);
      }
      break;
    case RunCommandEventEnum.NODE_PROCESSED:
      if (isTty) {
        spinnies.succeed(key(evt.workspace.name, evt), {
          text: `${capitalize(actionVerbBase)}ed ${evt.workspace.name} ${chalk.magenta(`[${evt.region}]`)}`,
        });
      } else {
        logger.info(
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
        logger.info(
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
    logger.error(chalk.underline(chalk.bold('\n▼ Error summary\n')));
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
      logger.error(
        chalk.bold(chalk.red(`#${i} - Failed to ${action} ${(evt as any).workspace.name} in ${region} region\n`)),
      );
    } else {
      logger.error(chalk.bold(chalk.red(`#${i} - Failed to ${action} ${(evt as any).workspace.name}\n`)));
    }

    if ((evt as any).error) {
      logger.error(chalk.bold(`#${i} - Error details:`));
      logger.error((evt as any).error);
      logger.lf();
    }
  }
  logger.info(chalk.underline(chalk.bold('▼ Execution summary\n')));
  if (verbose) {
    let i = 0;
    i++;
    for (const action of actions) {
      if ((action as DeployEvent).region && action.type !== RunCommandEventEnum.TARGETS_RESOLVED && action.type !== RunCommandEventEnum.SOURCES_CHANGED) {
        logger.info(
          chalk.bold(`#${i} - Successfully ${actionVerbBase}ed ${action.workspace.name} in ${(action as DeployEvent).region} region\n`),
        );
      } else if (action.type !== RunCommandEventEnum.TARGETS_RESOLVED && action.type !== RunCommandEventEnum.SOURCES_CHANGED) {
        logger.info(chalk.bold(`#${i} - Successfully ${actionVerbBase}ed ${(action).workspace.name}\n`));
      }
      if (isNodeSucceededEvent(action)) {
        action.result.commands.forEach((result) => {
          if (!isDaemon(result)) {
            logger.info(chalk.grey('> ' + result.command));
            logger.info(result.all);
          }
        });
      }
    }
  }
  logger.info(`Successfully ${actionVerbBase}ed ${total - failures.size}/${total} stacks`);
  logger.info(`Error occurred when ${actionVerbBase}ing ${failures.size} stacks\n`);
  if (failures.size) {
    logger.error(chalk.red('Process exited with errors'));
    process.exit(1);
  }
  logger.error(chalk.green('Process exited without errors'));
};

export const deploy = async (cmd: IDeployCmd): Promise<void> => {
  if (!cmd.e) {
    logger.error(chalk.red('You must specify a target environment using the -e option'));
    process.exit(1);
  }
  // Check working dir clean
  // TODO

  // Check branch mapping
  // if not good branch and not --skip-branch-check throw

  const projectRoot = resolveProjectRoot();
  const eventsLog = new EventsLog(undefined, [new EventLogsFileHandler(projectRoot, `mila-deploy-${Date.now()}`)]);

  // Validate env
  const { config, project } = await init(projectRoot, eventsLog);
  const state = new State(config);
  const env = state.findEnv(cmd.e);
  if (!env) {
    logger.error(chalk.red('Target environment not found in remote state. You must initialize environments using yarn mila env create <name>'));
    process.exit(1);
  }

  // Parse services
  for (const service of project.services.values()) {
    for (const region of env.regions) {
      const deployedService = state.findServiceInstance(env.name, service.name, region);
      if (deployedService) {
        const storedChecksums = ;
        const currentChecksums =;
        if (service) {

        }
      }
    }
  }

  // For each service in graph
    // For each region
      // If !deployed
        // (first deploy)
      // Else
        // get current sha1
        // get checksums
          // if =
            // (no changes since last deploy (sha1)
          // else
            // will be deployed

  // for each service in BD as not in graph
    // will be destroyed
  // Confirm
  // run


  return new Promise(async () => {
    logger.info(chalk.underline(chalk.bold('\n▼ Preparing request\n')));
    const reader = new ConfigReader(eventsLog);
    const config = reader.readConfig();
    checkEnv(config, cmd, 'You must provide a target stage to deploy services');
    const currentIAM = await getCurrentUserIAM();

    logger.info(chalk.underline(chalk.bold('\n▼ Request summary\n')));
    logger.info(chalk.bold('The following services will be deployed'));
    logger.info('Stage:', cmd.e);
    logger.info('Services:', cmd.s != null ? cmd.s : 'all');
    logger.info('As:', currentIAM);

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
    const options = await beforePackage(projectRoot, cmd, eventsLog);

    if(options.force) {
      logger.info('\n▼ Clean artifacts directories\n');
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
        logger.error(chalk.red('Error cleaning previous artifacts'));
        process.exit(1);
      }
    }

    logger.info('\nPackaging services\n');
    const packageResult = await packageServices(options);
    if (packageResult.failures.size) {
      await printReport(packageResult.success, packageResult.failures, options.service ? 1 : options.project.services.size, 'package', false);
      process.exit(1);
    }

    reader.validate(options.project);

    logger.info('\n▼ Deploying services\n');

    const spinnies = new Spinnies(spinniesOptions);

    const failures: Set<DeployEvent> = new Set();
    const actions: Set<DeployEvent> = new Set();

    const deployer = new Deployer({
      ...options,
      environment: cmd.e,
    });
    deployer.deploy(options.service).subscribe({
      next: (evt) => handleNext(evt, spinnies, failures, actions, cmd.verbose, "deploy"),
      error: (err) => {
        logger.error(chalk.red("Error deploying services"));
        logger.error(err);
        process.exit(1);
      },
      complete: async () => {
        await printReport(actions, failures, actions.size, "deploy", cmd.verbose);
        logger.info(`Successfully deploy from ${cmd.e} 🚀`);
        process.exit(0);
      }
    });
  });
};
