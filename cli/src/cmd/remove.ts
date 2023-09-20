import { IDeployCmd } from '../utils/deploy/cmd-options';
import { Runner } from '@microlambda/runner-core';
import { resolveProjectRoot } from '@microlambda/utils';
import { beforeDeploy } from '../utils/deploy/pre-requisites';
import { EventLogsFileHandler, EventsLog } from '@microlambda/logger';
import { logger } from '../utils/logger';
import chalk from 'chalk';
import { printAccountInfos } from './envs/list';
import { getConcurrency } from '../utils/get-concurrency';
import { resolveEnvs } from '@microlambda/core';
import { SSMResolverMode } from '@microlambda/environments';
import {checkIfEnvIsLock} from '../utils/check-env-lock';
import { prompt } from 'inquirer';
import Table from 'cli-table3';
import {IServiceInstance} from "@microlambda/remote-state";

export const remove = async (cmd: IDeployCmd): Promise<void> => {
  const projectRoot = resolveProjectRoot();
  const eventsLog = new EventsLog(undefined, [new EventLogsFileHandler(projectRoot, `mila-remove-${Date.now()}`)]);

  const { env, project, state, config, services } = await beforeDeploy(cmd, eventsLog);

  const runner = new Runner(project, getConcurrency(cmd.c), eventsLog);

  logger.lf();
  logger.info(chalk.underline(chalk.bold('▼ Account informations')));
  logger.lf();
  await printAccountInfos();

  const releaseLock = await checkIfEnvIsLock(cmd, env, project, config);

  // process.on('SIGINT', ... => realeaseLock..

  const servicesInstances = await state.listServices(cmd.e);

  const allRegions = [...env.regions];

  const table = new Table({
    head: ['Service', ...allRegions],
    style: {
      head: ['cyan'],
    },
  });

  const deployedServicesInstancesGroupedByName = new Map<string, Map<string, IServiceInstance>>();

  for (const servicesInstance of servicesInstances) {
    const deployedServicesInstances = deployedServicesInstancesGroupedByName.get(servicesInstance.name);
    if (deployedServicesInstances) {
      deployedServicesInstances.set(servicesInstance.region, servicesInstance);
    } else {
      deployedServicesInstancesGroupedByName.set(servicesInstance.name, new Map([[servicesInstance.region, servicesInstance]]));
    }
  }

  for (const [serviceName, instancesByRegion] of deployedServicesInstancesGroupedByName.entries()) {
    const row = [chalk.bold(serviceName)];
    for (const region of env.regions) {
      const serviceInstance = instancesByRegion.get(region);
      row.push(serviceInstance?.sha1 ?? '-');
    }
    table.push(row);
  }

  // eslint-disable-next-line no-console
  console.log(table.toString());

  console.debug('a');

  if (cmd.onlyPrompt) {
    console.debug('b');
    logger.info('Not performing destroy as --only-prompt option has been given');
    await releaseLock();
    process.exit(0);
  }

  console.debug('c', cmd);

  if (cmd.prompt) {
    console.debug('d');
    const answers = await prompt([
      {
        type: 'confirm',
        name: 'ok',
        message: `Are you sure you want to execute this remove on ${chalk.magenta.bold(env.name)}`,
      },
    ]);
    if (!answers.ok) {
      await releaseLock();
      process.exit(2);
    }
  }

  console.debug('e');

  // Source env
  const envs = await resolveEnvs(project, cmd.e, SSMResolverMode.ERROR, eventsLog.scope('remove/env'));

  // Run target "destroy" using mila runner
  // TODO: Perform in every regions (check how its done in deploy you have to add AWS_REGION to env)
  runner.runCommand({
    cmd: 'destroy',
    env: envs,
    mode: 'parallel',
    stdio: cmd.verbose ? 'inherit' : 'pipe',
    workspaces: services ?? [...project.services.values()],
  });
  await releaseLock();
};
