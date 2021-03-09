/* eslint-disable no-console */
import { beforePackage, IPackageCmd } from './package';
import Spinnies from 'spinnies';
import chalk from 'chalk';
import { prompt } from 'inquirer';
import { ConfigReader, RecompilationScheduler, Logger, Service, getAccountIAM, IConfig } from '@microlambda/core';
import { IDeployEvent } from '@microlambda/core/lib';

interface IDeployCmd extends IPackageCmd {
  E: string;
  prompt: boolean;
  verbose: boolean;
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
  spinners: Set<string>,
  failures: Set<IDeployEvent>,
  verbose: boolean,
  action: 'deploy' | 'remove',
): void => {
  const hasSpinner = (service: Service): boolean => {
    const alreadyExists = spinners.has(service.getName());
    if (!alreadyExists) {
      spinners.add(service.getName());
    }
    return alreadyExists;
  };
  const tty = process.stdout.isTTY;
  const capitalize = (input: string): string => input.slice(0, 1).toUpperCase() + input.slice(1);
  switch (evt.type) {
    case 'started':
      if (tty) {
        spinnies[hasSpinner(evt.service) ? 'update' : 'add'](evt.service.getName(), {
          text: `${capitalize(action)}ing ${evt.service.getName()} ${chalk.magenta(`[${evt.region}]`)}`,
        });
      } else {
        console.info(`${chalk.bold(evt.service.getName())} ${action}ing ${chalk.magenta(`[${evt.region}]`)}`);
      }
      break;
    case 'succeeded':
      if (tty) {
        spinnies.succeed(evt.service.getName(), {
          text: `${capitalize(action)}ed ${evt.service.getName()} ${chalk.magenta(`[${evt.region}]`)}`,
        });
      } else {
        console.info(
          `${chalk.bold(evt.service.getName())} - Successfully ${action}ed ${chalk.magenta(`[${evt.region}]`)}`,
        );
      }
      break;
    case 'failed':
      failures.add(evt);
      if (tty) {
        spinnies.fail(evt.service.getName(), {
          text: `Error ${action}ing ${evt.service.getName()} ! ${chalk.magenta(`[${evt.region}]`)}`,
        });
      } else {
        console.info(
          `${chalk.bold(evt.service.getName())} - ${capitalize(action)} failed ${chalk.magenta(`[${evt.region}]`)}`,
        );
      }
  }
  if (verbose) {
    console.log(evt.service.logs.deploy.join(''));
  }
};

export const printReport = (failures: Set<IDeployEvent>, targets: Service[], action: 'deploy' | 'remove'): void => {
  if (failures.size) {
    console.error(chalk.underline(chalk.bold('\n▼ Error summary\n')));
  }
  let i = 0;
  for (const evt of failures) {
    i++;
    console.error(
      chalk.bold(chalk.red(`#${i} - Failed to ${action} ${evt.service.getName()} in ${evt.region} region\n`)),
    );
    if (evt.error) {
      console.error(chalk.bold(`#${i} - Error details:`));
      console.error(evt.error);
      console.log('');
    }
    if (evt.service.logs.deploy) {
      console.error(chalk.bold(`#${i} - Execution logs:`));
      console.log(evt.service.logs[action].join(''));
      console.log('');
    }
  }
  console.info(chalk.underline(chalk.bold('▼ Execution summary\n')));
  console.info(`Successfully ${action}ed ${targets.length - failures.size}/${targets.length} services`);
  console.info(`Error occurred when ${action}ing ${failures.size} services\n`);
  if (failures.size) {
    console.error(chalk.red('Process exited with errors'));
    process.exit(1);
  }
  console.error(chalk.green('Process exited without errors'));
};

export const deploy = async (cmd: IDeployCmd, logger: Logger, scheduler: RecompilationScheduler): Promise<void> => {
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
  const { graph, service } = await beforePackage(cmd, scheduler, logger);
  reader.validate(graph);

  const services = cmd.S ? [service as Service] : graph.getServices();

  console.info('\n▼ Deploying services\n');

  const spinnies = new Spinnies({
    failColor: 'white',
    succeedColor: 'white',
    spinnerColor: 'cyan',
  });
  const spinners = new Set<string>();

  if (cmd.C) {
    scheduler.setConcurrency(cmd.C);
  }
  const failures: Set<IDeployEvent> = new Set();

  scheduler.deploy(services, cmd.E).subscribe(
    (evt) => {
      handleNext(evt, spinnies, spinners, failures, cmd.verbose, 'deploy');
    },
    (err) => {
      console.error(chalk.red('Error deploying services'));
      console.error(err);
      process.exit(1);
    },
    () => {
      printReport(failures, services, 'deploy');
      console.info(`Successfully deployed to ${cmd.E} :rocket:`);
      process.exit(0);
    },
  );
};
