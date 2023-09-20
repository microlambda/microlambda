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
import { checkIfEnvIsLock } from '../utils/check-env-lock';
import { prompt } from 'inquirer';
import Table from 'cli-table3';

export const remove = async (cmd: IDeployCmd): Promise<void> => {
  const projectRoot = resolveProjectRoot();
  const eventsLog = new EventsLog(undefined, [new EventLogsFileHandler(projectRoot, `mila-remove-${Date.now()}`)]);

  const { env, project, state, config, services } = await beforeDeploy(cmd, eventsLog);

  const runner = new Runner(project, getConcurrency(cmd.c), eventsLog);

  logger.lf();
  logger.info(chalk.underline(chalk.bold('▼ Account informations')));
  logger.lf();
  await printAccountInfos();

  await checkIfEnvIsLock(cmd, env, project, config);

  // process.on('SIGINT', ... => realeaseLock..

  const servicesInstances = await state.listServices(cmd.e);
  servicesInstances.map((i) => [i.name, i.sha1]);

  const table = new Table({
    head: ['Service', 'sha1'],
    style: {
      head: ['cyan'],
    },
  });

  for (const [serviceName, sha1] of servicesInstances) {
    const row = [chalk.bold(serviceName)];
    row.push(chalk.grey(sha1));
    table.push(row);
  }

  // eslint-disable-next-line no-console
  console.log(table.toString());

  if (cmd.onlyPrompt) {
    logger.info('Only Prompt');
    process.exit(0);
  }

  if (cmd.prompt) {
    const answers = await prompt([
      {
        type: 'confirm',
        name: 'ok',
        message: `Are you sure you want to execute this remove on ${chalk.magenta.bold(env.name)}`,
      },
    ]);
    if (!answers.ok) {
      // await releaseLock(); ??
      process.exit(2);
    }
  }

  // Source env
  const envs = await resolveEnvs(project, cmd.e, SSMResolverMode.ERROR, eventsLog.scope('remove/env'));

  // Run target "destroy" using mila runner
  runner.runCommand({
    cmd: 'destroy',
    env: envs,
    mode: 'parallel',
    stdio: cmd.verbose ? 'inherit' : 'pipe',
    workspaces: services ?? [...project.services.values()],
  });
};
