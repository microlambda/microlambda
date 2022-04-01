/* eslint-disable no-console */
import inquirer from 'inquirer';
import {Deployer, DeployEvent, Logger} from '@microlambda/core';
import chalk from 'chalk';
import { checkEnv, getCurrentUserIAM, handleNext, IDeployCmd, printReport } from './deploy';
import { init } from './start';
import Spinnies from 'spinnies';

export const remove = async (cmd: IDeployCmd, logger: Logger): Promise<void> => {
  return new Promise(async () => {
    console.info(chalk.underline(chalk.bold('\n▼ Preparing request\n')));
    const { config, project } = await init(logger);
    checkEnv(config, cmd, 'You must provide a target stage to remove services');
    const service = cmd.s ? project.services.get(cmd.s) : null;
    if (cmd.s && !service) {
      console.error(chalk.red('Error: unknown service', cmd.s));
      process.exit(1);
    }
    const targets = service ? [service] : Array.from(project.services.values());
    const currentIAM = await getCurrentUserIAM();
    console.info(chalk.underline(chalk.bold('\n▼ Request summary\n')));
    console.info(chalk.bold('Warning: the following services will be deleted'));
    console.info('Stage:', cmd.e);
    console.info('Services:', cmd.s != null ? cmd.s : 'all');
    console.info('As:', currentIAM);

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
      console.info('');
      if (!confirm.ok) {
        console.info('Aborted by user');
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
        console.error(chalk.red('Error removing services'));
        console.error(err);
        process.exit(1);
      },
      complete: async () => {
        await printReport(actions, failures, actions.size, 'remove', cmd.verbose);
        console.info(`Successfully removed from ${cmd.e} :boom:`);
        process.exit(0);
      },
    });
  });
};
