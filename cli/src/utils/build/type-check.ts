import { MilaSpinnies } from '../spinnies';
import { RunCommandEvent, RunCommandEventEnum, Runner } from '@microlambda/runner-core';
import { logger } from '../logger';
import chalk from 'chalk';
import { IBuildOptions } from './options';
import { printError } from './print-errors';

export const typeCheck = async (options: IBuildOptions): Promise<void> => {
  const inProgress = new Set<string>();
  const spinnies = new MilaSpinnies(options.verbose);
  return new Promise<void>((resolve, reject) => {
    const onNext = (evt: RunCommandEvent): void => {
      if (evt.type === RunCommandEventEnum.TARGETS_RESOLVED) {
        if (!evt.targets.some((target) => target.hasCommand)) {
          logger.error(chalk.red('No workspace found for target build. Please add a build script in mila.json'));
        }
      } else if (evt.type === RunCommandEventEnum.NODE_SKIPPED) {
        logger.info(chalk.bold.yellow('-'), 'Skipped', evt.target.workspace.name, chalk.grey('(no build target)'));
      } else if (evt.type === RunCommandEventEnum.NODE_STARTED) {
        spinnies.add(evt.target.workspace.name, `Compiling ${evt.target.workspace.name}`);
        inProgress.add(evt.target.workspace.name);
      } else if (evt.type === RunCommandEventEnum.NODE_PROCESSED) {
        inProgress.delete(evt.target.workspace.name);
        spinnies.succeed(
          evt.target.workspace.name,
          `${evt.target.workspace.name} compiled ${chalk.cyan(evt.result.overall + 'ms')}${
            evt.result.fromCache ? chalk.grey(' (from cache)') : ''
          }`,
        );
      } else if (evt.type === RunCommandEventEnum.NODE_ERRORED) {
        inProgress.delete(evt.target.workspace.name);
        spinnies.fail(evt.target.workspace.name, `Error compiling ${evt.target.workspace.name}`);
        inProgress.forEach((w) => spinnies.update(w, `${chalk.bold.yellow('-')} Compilation aborted ${w}`));
        spinnies.stopAll();
        logger.error(`\n${chalk.bold.red('> Error details:')}\n`);
        printError(evt.error, spinnies);
        return reject();
      }
    };
    const onError = (err: unknown): void => {
      inProgress.forEach((w) => {
        spinnies.update(w, `${chalk.bold.yellow('-')} Compilation aborted ${w}`);
      });
      spinnies.stopAll();
      logger.error(`\n${chalk.bold.red('> Error details:')}\n`);
      printError(err, spinnies);
      return reject();
    };
    const onComplete = (): void => {
      return resolve();
    };
    const runner = new Runner(options.project, options.concurrency);
    runner
      .runCommand({
        cmd: 'build',
        to: options.workspaces,
        mode: 'topological',
        force: options.force,
        stdio: spinnies.stdio,
      })
      .subscribe({ next: onNext, error: onError, complete: onComplete });
  });
};
