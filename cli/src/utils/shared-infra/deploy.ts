import {logger} from "../logger";
import chalk from "chalk";
import {
  deploySharedInfrastructure,
  ISharedInfraFailedDeployEvent,
  removeSharedInfrastructure, SharedInfraDeployEventType,
} from "@microlambda/core";
import {getConcurrency} from "../get-concurrency";
import {MilaSpinnies} from "../spinnies";
import {relative} from "path";
import {IRootConfig} from "@microlambda/config";
import {IEnvironment} from "@microlambda/remote-state";

export const deploySharedInfra = async (params: {
  action: 'remove' | 'deploy',
  projectRoot: string,
  config: IRootConfig,
  env: IEnvironment,
  concurrency?: string,
  isVerbose: boolean,
  releaseLock: (msg?: string) => Promise<void>,
}): Promise<void> => {
  const { projectRoot, config, env, concurrency, isVerbose, releaseLock, action } = params;
  logger.lf();
  logger.info(chalk.underline(chalk.bold(`▼ ${action === 'deploy' ? 'Updating' : 'Removing'} shared infrastructure`)));
  logger.lf();
  const deploySharedInfra$ = action === 'deploy'
    ? await deploySharedInfrastructure(projectRoot, config, env, getConcurrency(concurrency))
    : await removeSharedInfrastructure(projectRoot, config, env, getConcurrency(concurrency));
  await new Promise<void>((resolve) => {
    const spinnies = new MilaSpinnies(isVerbose);
    const failures = new Set<ISharedInfraFailedDeployEvent>();
    deploySharedInfra$.subscribe({
      next: (evt) => {
        switch (evt.type) {
          case SharedInfraDeployEventType.STACKS_RESOLVED:
            if (!evt.stacks.length) {
              logger.success('Nothing to do 👌');
            }
            break;
          case SharedInfraDeployEventType.NO_CHANGES:
            spinnies.add(
              `${evt.stack}-${evt.region}`,
              `Skipping ${relative(projectRoot, evt.stack)} (no changes) ${chalk.magenta(`[${evt.region}]`)}`,
            );
            spinnies.succeed(
              `${evt.stack}-${evt.region}`,
              `Skipped ${relative(projectRoot, evt.stack)} (no changes) ${chalk.magenta(`[${evt.region}]`)}`,
            );
            break;
          case SharedInfraDeployEventType.DEPLOYING:
            spinnies.add(
              `${evt.stack}-${evt.region}`,
              `Deploying ${relative(projectRoot, evt.stack)} ${chalk.magenta(`[${evt.region}]`)}`,
            );
            break;
          case SharedInfraDeployEventType.DEPLOYED:
            spinnies.succeed(
              `${evt.stack}-${evt.region}`,
              `Successfully deployed ${relative(projectRoot, evt.stack)} ${chalk.magenta(`[${evt.region}]`)}`,
            );
            break;
          case SharedInfraDeployEventType.FAILED_DEPLOY:
            spinnies.fail(
              `${evt.stack}-${evt.region}`,
              `Failed to deploy ${relative(projectRoot, evt.stack)} ${chalk.magenta(`[${evt.region}]`)}`,
            );
            failures.add(evt as ISharedInfraFailedDeployEvent);
            break;
          case SharedInfraDeployEventType.REMOVING:
            spinnies.add(
              `${evt.stack}-${evt.region}`,
              `Removing ${relative(projectRoot, evt.stack)} ${chalk.magenta(`[${evt.region}]`)}`,
            );
            break;
          case SharedInfraDeployEventType.REMOVED:
            spinnies.succeed(
              `${evt.stack}-${evt.region}`,
              `Successfully removed ${relative(projectRoot, evt.stack)} ${chalk.magenta(`[${evt.region}]`)}`,
            );
            break;
          case SharedInfraDeployEventType.FAILED_REMOVE:
            spinnies.fail(
              `${evt.stack}-${evt.region}`,
              `Failed to remove ${relative(projectRoot, evt.stack)} ${chalk.magenta(`[${evt.region}]`)}`,
            );
            failures.add(evt as ISharedInfraFailedDeployEvent);
            break;
        }
      },
      error: (err) => {
        logger.error('Error happened updating shared infrastructure');
        logger.error(err);
        releaseLock().then(() => process.exit(1));
      },
      complete: () => {
        if (failures.size) {
          logger.error('Error happened updating shared infrastructure');
          for (const failure of failures) {
            logger.error(
              `Error happened ${action === 'deploy' ? 'updating' : 'removing'} ${relative(projectRoot, failure.stack)} in region ${failure.region}`,
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
}
