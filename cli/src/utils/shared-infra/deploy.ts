import { logger } from '../logger';
import chalk from 'chalk';
import {
  deploySharedInfrastructure,
  getConcurrency,
  ISharedInfraFailedDeployEvent,
  Project,
  removeSharedInfrastructure,
  SharedInfraDeployEventType,
} from '@microlambda/core';
import { MilaSpinnies } from '../spinnies';
import { IRootConfig, IStateConfig } from '@microlambda/config';
import { IEnvironment } from '@microlambda/remote-state';

export const deploySharedInfra = async (params: {
  action: 'remove' | 'deploy';
  project: Project;
  config: IStateConfig;
  env: IEnvironment;
  concurrency?: string;
  isVerbose: boolean;
  force: boolean;
  currentRevision: string;
  releaseLock: (msg?: string) => Promise<void>;
  onlyEnvSpecific: boolean;
}): Promise<void> => {
  const { project, config, force, onlyEnvSpecific, currentRevision, env, concurrency, isVerbose, releaseLock, action } =
    params;
  logger.lf();
  logger.info(chalk.underline(chalk.bold(`▼ ${action === 'deploy' ? 'Updating' : 'Removing'} shared infrastructure`)));
  logger.lf();
  const deploySharedInfra$ =
    action === 'deploy'
      ? await deploySharedInfrastructure(
          {
            project,
            config,
            env,
            concurrency: getConcurrency(concurrency),
            verbose: isVerbose,
            force,
            currentRevision,
            onlyEnvSpecific,
          },
          logger,
        )
      : await removeSharedInfrastructure(
          {
            project,
            config,
            env,
            concurrency: getConcurrency(concurrency),
            verbose: isVerbose,
            currentRevision,
            onlyEnvSpecific,
          },
          logger,
        );
  await new Promise<void>((resolve) => {
    const spinnies = new MilaSpinnies(isVerbose);
    const failures = new Set<ISharedInfraFailedDeployEvent>();
    deploySharedInfra$.subscribe({
      next: (evt) => {
        switch (evt.type) {
          case SharedInfraDeployEventType.WORKSPACES_RESOLVED:
            if (!evt.workspaces.length) {
              logger.success('Nothing to do 👌');
            }
            break;
          case SharedInfraDeployEventType.NO_CHANGES:
            spinnies.add(
              `${evt.workspace.name}-${evt.region}`,
              `Skipping ${evt.workspace.name} (no changes) ${chalk.magenta(`[${evt.region}]`)}`,
            );
            spinnies.succeed(
              `${evt.workspace.name}-${evt.region}`,
              `Skipped ${evt.workspace.name} (no changes) ${chalk.magenta(`[${evt.region}]`)}`,
            );
            break;
          case SharedInfraDeployEventType.DEPLOYING:
            spinnies.add(
              `${evt.workspace.name}-${evt.region}`,
              `Deploying ${evt.workspace.name} ${chalk.magenta(`[${evt.region}]`)}`,
            );
            break;
          case SharedInfraDeployEventType.DEPLOYED:
            spinnies.succeed(
              `${evt.workspace.name}-${evt.region}`,
              `Successfully deployed ${evt.workspace.name} ${chalk.magenta(`[${evt.region}]`)}`,
            );
            break;
          case SharedInfraDeployEventType.FAILED_DEPLOY:
            spinnies.fail(
              `${evt.workspace.name}-${evt.region}`,
              `Failed to deploy ${evt.workspace.name} ${chalk.magenta(`[${evt.region}]`)}`,
            );
            failures.add(evt as ISharedInfraFailedDeployEvent);
            break;
          case SharedInfraDeployEventType.REMOVING:
            spinnies.add(
              `${evt.workspace.name}-${evt.region}`,
              `Removing ${evt.workspace.name} ${chalk.magenta(`[${evt.region}]`)}`,
            );
            break;
          case SharedInfraDeployEventType.REMOVED:
            spinnies.succeed(
              `${evt.workspace.name}-${evt.region}`,
              `Successfully removed ${evt.workspace.name} ${chalk.magenta(`[${evt.region}]`)}`,
            );
            break;
          case SharedInfraDeployEventType.FAILED_REMOVE:
            spinnies.fail(
              `${evt.workspace.name}-${evt.region}`,
              `Failed to remove ${evt.workspace.name} ${chalk.magenta(`[${evt.region}]`)}`,
            );
            failures.add(evt as ISharedInfraFailedDeployEvent);
            break;
        }
      },
      error: (err) => {
        spinnies.stopAll();
        logger.error('Error happened updating shared infrastructure');
        logger.error(err);
        releaseLock().then(() => process.exit(1));
      },
      complete: () => {
        spinnies.stopAll();
        if (failures.size) {
          logger.error('Error happened updating shared infrastructure');
          for (const failure of failures) {
            logger.error(
              `Error happened ${action === 'deploy' ? 'updating' : 'removing'} ${failure.workspace.name} in region ${
                failure.region
              }`,
            );
            const isExecaError = (err: unknown): err is { all: string } => !!(failure.err as { all: string }).all;
            if (isExecaError(failure.err)) {
              logger.error(failure.err.all);
            } else {
              logger.error(failure.err);
            }
          }
          releaseLock().then(() => process.exit(1));
        }
        return resolve();
      },
    });
  });
};
