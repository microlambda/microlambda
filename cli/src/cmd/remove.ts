import inquirer from 'inquirer';
import {Deployer, DeployEvent} from '@microlambda/core';
import chalk from 'chalk';
import { checkEnv, getCurrentUserIAM, handleNext, IDeployCmd, printReport } from './deploy';
import { init } from './start';
import Spinnies from 'spinnies';
import { EventsLog, EventLogsFileHandler } from "@microlambda/logger";
import { logger } from '../utils/logger';
import { resolveProjectRoot } from '@microlambda/utils';

export const remove = async (cmd: IDeployCmd): Promise<void> => {
  return new Promise(async () => {
    logger.info(chalk.underline(chalk.bold('\n▼ Preparing request\n')));
    const projectRoot = resolveProjectRoot();
    const eventsLog = new EventsLog(undefined, [new EventLogsFileHandler(projectRoot, `mila-remove-${Date.now()}`)]);
    const { config, project } = await init(projectRoot, eventsLog);
    checkEnv(config, cmd, 'You must provide a target stage to remove services');
    const service = cmd.s ? project.services.get(cmd.s) : null;
    if (cmd.s && !service) {
      logger.error(chalk.red('Error: unknown service', cmd.s));
      process.exit(1);
    }
    const targets = service ? [service] : Array.from(project.services.values());
    const currentIAM = await getCurrentUserIAM();
    logger.info(chalk.underline(chalk.bold('\n▼ Request summary\n')));
    logger.info(chalk.bold('Warning: the following services will be deleted'));
    logger.info('Stage:', cmd.e);
    logger.info('Services:', cmd.s != null ? cmd.s : 'all');
    logger.info('As:', currentIAM);

    if (cmd.onlyPrompt) {
      process.exit(0);
    }

    if (cmd.prompt) {
      const confirm = await inquirer.prompt([
        {
          name: 'ok',
          type: 'confirm',
          message: `This will remove the following services. Are you sure to proceed ?`,
          default: true,
        },
      ]);
      logger.info('');
      if (!confirm.ok) {
        logger.info('Aborted by user');
        process.exit(0);
      }
    }

    const spinnies = new Spinnies({
      failColor: 'white',
      succeedColor: 'white',
      spinnerColor: 'cyan',
    });


    const failures: Set<DeployEvent> = new Set();
    const actions: Set<DeployEvent> = new Set();

    const remover = new Deployer({
      project,
      targets,
      force: true,
      environment: cmd.e,
    }, 'remove');
    remover.deploy().subscribe({
      next: (evt) => {
        handleNext(evt, spinnies, failures, actions, cmd.verbose, 'remove');
      },
      error: (err) => {
        logger.error(chalk.red('Error removing services'));
        logger.error(err);
        process.exit(1);
      },
      complete: async () => {
        await printReport(actions, failures, actions.size, 'remove', cmd.verbose);
        logger.info(`Successfully removed from ${cmd.e} :boom:`);
        process.exit(0);
      },
    });
  });
};
