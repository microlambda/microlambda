/* eslint-disable no-console */
import inquirer from 'inquirer';
import { Logger } from '@microlambda/core';
import chalk from 'chalk';
import { checkEnv, getCurrentUserIAM, handleNext, IDeployCmd, printReport } from './deploy';
import { init } from './start';
import Spinnies from 'spinnies';

export const remove = async (cmd: IDeployCmd, logger: Logger, scheduler: RecompilationScheduler): Promise<void> => {
  return new Promise(async () => {
    console.info(chalk.underline(chalk.bold('\n▼ Preparing request\n')));
    const { config, graph } = await init(logger, scheduler, 3000);
    checkEnv(config, cmd, 'You must provide a target stage to remove services');
    const services = graph.getServices();
    const service = cmd.S ? services.find((s) => s.getName() === cmd.S) : null;
    if (cmd.S && !service) {
      console.error(chalk.red('Error: unknown service', cmd.S));
      process.exit(1);
    }
    const currentIAM = await getCurrentUserIAM();
    console.info(chalk.underline(chalk.bold('\n▼ Request summary\n')));
    console.info(chalk.bold('Warning: the following services will be deleted'));
    console.info('Stage:', cmd.E);
    console.info('Services:', cmd.S != null ? cmd.S : 'all');
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

    const toRemove = service ? [service] : services;

    const failures: Set<IDeployEvent> = new Set();
    const actions: Set<IDeployEvent> = new Set();

    if (cmd.C) {
      scheduler.setConcurrency(Number(cmd.C));
    }

    scheduler.remove(toRemove, String(cmd.E)).subscribe(
      (evt) => {
        handleNext(evt, spinnies, failures, actions, cmd.verbose, 'remove');
      },
      (err) => {
        console.error(chalk.red('Error removing services'));
        console.error(err);
        process.exit(1);
      },
      async () => {
        await printReport(failures, actions.size, 'remove');
        console.info(`Successfully removed from ${cmd.E} :boom:`);
        process.exit(0);
      },
    );
  });
};
