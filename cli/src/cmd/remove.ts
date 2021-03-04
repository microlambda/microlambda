/* eslint-disable no-console */
import inquirer from 'inquirer';
import { IRemoveEvent, IRemoveEventEnum, Logger, RecompilationScheduler } from '@microlambda/core';
import chalk from 'chalk';
import { checkEnv, getCurrentUserIAM } from './deploy';
import { init } from './start';
import Spinnies from 'spinnies';

export const remove = async (
  cmd: { S: string | null; E: string | null; prompt: boolean; verbose: boolean },
  logger: Logger,
  scheduler: RecompilationScheduler,
): Promise<void> => {
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

  const failures: Set<IRemoveEvent> = new Set();

  scheduler.remove(toRemove, String(cmd.E)).subscribe(
    (evt) => {
      const action = (): string => {
        switch (evt.event) {
          case IRemoveEventEnum.DELETING_BASE_PATH_MAPPING:
            return 'Deleting base path mapping';
          case IRemoveEventEnum.DELETED_BASE_PATH_MAPPING:
            return 'Base path mapping deleted';
          case IRemoveEventEnum.ERROR_DELETING_BASE_PATH_MAPPING:
            return 'Error deleting base path mapping';
          case IRemoveEventEnum.DELETING_CLOUD_FORMATION_STACK:
            return 'Deleting CloudFormation stack';
          case IRemoveEventEnum.DELETED_CLOUD_FORMATION_STACK:
            return 'CloudFormation stack deleted';
          case IRemoveEventEnum.ERROR_DELETING_CLOUD_FORMATION_STACK:
            return 'Error deleting CloudFormation stack';
          case IRemoveEventEnum.DELETING_DNS_RECORDS:
            return 'Deleting DNS records';
          case IRemoveEventEnum.DELETED_DNS_RECORDS:
            return 'DNS records deleted';
          case IRemoveEventEnum.ERROR_DELETING_DNS_RECORDS:
            return 'Error deleting DNS records';
          case IRemoveEventEnum.DELETING_CUSTOM_DOMAIN:
            return 'Deleting custom domain';
          case IRemoveEventEnum.DELETED_CUSTOM_DOMAIN:
            return 'Custom domain deleted';
          case IRemoveEventEnum.ERROR_DELETING_CUSTOM_DOMAIN:
            return 'Error deleting custom domain';
        }
        return 'UNKNOWN_ACTION';
      };

      const tty = process.stdout.isTTY;

      switch (evt.status) {
        case 'add':
        case 'update':
          if (tty) {
            spinnies[evt.status](evt.service.getName(), {
              text: `Removing ${evt.service.getName()} ${chalk.cyan(action())} ${chalk.magenta(`[${evt.region}]`)}`,
            });
          } else {
            console.info(
              `${chalk.bold(evt.service.getName())} - ${chalk.cyan(action())} ${chalk.magenta(`[${evt.region}]`)}`,
            );
          }
          break;
        case 'succeed':
          if (tty) {
            spinnies.succeed(evt.service.getName(), {
              text: `Removed ${evt.service.getName()} ${chalk.magenta(`[${evt.region}]`)}`,
            });
          } else {
            console.info(
              `${chalk.bold(evt.service.getName())} - Successfully removed ${chalk.magenta(`[${evt.region}]`)}`,
            );
          }
          break;
        case 'fail':
          failures.add(evt);
          if (tty) {
            spinnies.fail(evt.service.getName(), {
              text: `Error removing ${evt.service.getName()} ! ${chalk.magenta(`[${evt.region}]`)}`,
            });
          } else {
            console.info(`${chalk.bold(evt.service.getName())} - Remove failed ${chalk.magenta(`[${evt.region}]`)}`);
          }
      }
      if (evt.event === IRemoveEventEnum.DELETED_CUSTOM_DOMAIN && cmd.verbose) {
        console.log(evt.service.logs.deleteDomain.join(''));
      }
      if (evt.event === IRemoveEventEnum.DELETED_CLOUD_FORMATION_STACK && cmd.verbose) {
        console.log(evt.service.logs.remove.join(''));
      }
    },
    (err) => {
      console.error(err);
      process.exit(1);
    },
    () => {
      if (failures.size) {
        console.error(chalk.underline(chalk.bold('\n▼ Error summary\n')));
      }
      let i = 0;
      for (const evt of failures) {
        i++;
        console.error(
          chalk.bold(chalk.red(`#${i} - Failed to remove ${evt.service.getName()} in ${evt.region} region\n`)),
        );
        if (evt.error) {
          console.error(chalk.bold(`#${i} - Error details:`));
          console.error(evt.error);
          console.log('');
        }
        if (evt.service.logs.remove) {
          console.error(chalk.bold(`#${i} - Execution logs:`));
          console.log(evt.service.logs.remove.join(''));
          console.log('');
        }
      }
      console.info(chalk.underline(chalk.bold('▼ Execution summary\n')));
      console.info(`Successfully removed ${toRemove.length - failures.size}/${toRemove.length} services`);
      console.info(`Error occurred when removing ${failures.size} services\n`);
      if (failures.size) {
        console.error(chalk.red('Process exited with errors'));
        process.exit(1);
      }
      console.error(chalk.green('Process exited without errors'));
      process.exit(0);
    },
  );
};
