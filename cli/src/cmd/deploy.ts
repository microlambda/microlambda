import Spinnies from 'spinnies';
import chalk from 'chalk';
import {prompt} from 'inquirer';
import { ConfigReader, Deployer, DeployEvent, Project, Workspace } from '@microlambda/core';
import { spinniesOptions } from "../utils/spinnies";
import { logger } from '../utils/logger';
import { LockManager } from '@microlambda/remote-state';
import { resolveDeltas } from '../utils/deploy/resolve-deltas';
import { beforeDeploy } from '../utils/deploy/pre-requisites';
import { IDeployCmd } from '../utils/deploy/cmd-options';
import { EventLogsFileHandler, EventsLog } from '@microlambda/logger';
import { resolveProjectRoot } from '@microlambda/utils';
import { handleNext } from '../utils/deploy/handle-next';
import { printReport } from '../utils/deploy/print-report';
import { packageServices } from '../utils/package/do-package';
import { Workspace as CentipodWorkspace } from '@microlambda/runner-core';
import { getConcurrency } from '../utils/get-concurrency';

export const deploy = async (cmd: IDeployCmd): Promise<void> => {
  logger.lf();
  logger.info(chalk.underline(chalk.bold('▼ Preparing deployment')));
  logger.lf();

  const projectRoot = resolveProjectRoot();
  const eventsLog = new EventsLog(undefined, [new EventLogsFileHandler(projectRoot, `mila-build-${Date.now()}`)]);

  const { env, project, state, config } = await beforeDeploy(cmd);
  const lock = new LockManager(config);
  if (await lock.isLocked(env.name)) {
    logger.lf();
    logger.info('🔒 Environment is locked. Waiting for the lock to be released');
    await lock.waitLockToBeReleased(env.name);
  }
  await lock.lock(env.name);
  try {
    const operations = await resolveDeltas(env, project, cmd, state, config);
    if (cmd.onlyPrompt) {
      await lock.releaseLock(env.name);
      process.exit(0);
    }
    if (cmd.prompt) {
      const answers = await prompt([
        {
          type: 'confirm',
          name: 'ok',
          message: `Are you sure you want to execute this deployment on ${chalk.magenta.bold(env.name)}`,
        },
      ]);
      if (!answers.ok) {
        await lock.releaseLock(env.name);
        process.exit(2);
      }
    }
    const toPackage = new Set<Workspace>();
    for (const [serviceName, serviceOps] of operations.entries()) {
      const service = project.services.get(serviceName);
      const isDeployedInAtLeastOneRegion = [...serviceOps.values()].some((action) => ['redeploy', 'first-deploy'].includes(action));
      if (service && isDeployedInAtLeastOneRegion) {
        toPackage.add(service)
      }
    }

    await packageServices({
      project,
      service: undefined,
      affected: undefined,
      force: cmd.force || false,
      verbose: cmd.verbose || false,
      concurrency: getConcurrency(cmd.c),
      targets: [...toPackage],
    })
    await lock.releaseLock(env.name);
    process.exit(1);
  } catch (e) {
    logger.error('Deployment failed, releasing lock...');
    await lock.releaseLock(env.name);
    process.exit(1);
  }


  /*return new Promise(async () => {

    const options = await beforePackage(projectRoot, cmd, eventsLog);



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
  });*/
};
