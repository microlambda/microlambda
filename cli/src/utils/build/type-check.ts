import Spinnies from 'spinnies';
import { spinniesOptions } from '../spinnies';
import { RunCommandEvent, RunCommandEventEnum, Runner } from '@microlambda/runner-core';
import { logger } from '../logger';
import chalk from 'chalk';
import { IBuildOptions } from './options';
import { printError } from './print-errors';

export const typeCheck = async (options: IBuildOptions): Promise<void> => {
  const spinnies = new Spinnies(spinniesOptions);
  const inProgress = new Set<string>();
  return new Promise<void>((resolve, reject) => {
    const onNext = (evt: RunCommandEvent): void => {
      if (evt.type === RunCommandEventEnum.TARGETS_RESOLVED) {
        if (!evt.targets.some((target) => target.hasCommand)) {
          logger.error(chalk.red('No workspace found for target build. Please add a build script in mila.json'));
        }
      } else if (evt.type === RunCommandEventEnum.NODE_SKIPPED && !evt.affected) {
        logger.info(chalk.bold.yellow('-'), 'Skipped', evt.workspace.name, chalk.grey('(unaffected)'))
      } else if (evt.type === RunCommandEventEnum.NODE_STARTED) {
        spinnies.add(evt.workspace.name, {text: `Compiling ${evt.workspace.name}` });
        inProgress.add(evt.workspace.name);
      } else if (evt.type === RunCommandEventEnum.NODE_PROCESSED) {
        inProgress.delete(evt.workspace.name);
        if (spinnies.pick(evt.workspace.name)) {
          spinnies.succeed(evt.workspace.name, {
            text: `${evt.workspace.name} compiled ${chalk.cyan(evt.result.overall + 'ms')}${evt.result.fromCache ? chalk.grey(' (from cache)') : ''}`,
          });
        }
      } else if (evt.type === RunCommandEventEnum.NODE_ERRORED) {
        inProgress.delete(evt.workspace.name);
        if (spinnies.pick(evt.workspace.name)) {
          spinnies.fail(evt.workspace.name, {
            text: `Error compiling ${evt.workspace.name}`,
          });
        }
        inProgress.forEach((w) => spinnies.update(w, { text: `${chalk.bold.yellow('-')} Compilation aborted ${w}`}));
        spinnies.stopAll();
        logger.error(`\n${chalk.bold.red('> Error details:')}\n`);
        printError(evt.error)
        return reject();
      }
    };
    const onError = (err: unknown): void => {
      inProgress.forEach((w) => {
        if (spinnies.pick(w)) {
          spinnies.update(w, { text: `${chalk.bold.yellow('-')} Compilation aborted ${w}` });
        }
      });
      spinnies.stopAll();
      logger.error(`\n${chalk.bold.red('> Error details:')}\n`);
      printError(err, spinnies)
      return reject();
    };
    const onComplete = (): void => {
      return resolve();
    };
    const runner = new Runner(options.project);
    runner.runCommand({
      cmd: 'build',
      to: options.workspaces,
      mode: 'topological',
      force: options.force,
    }).subscribe({ next: onNext, error: onError, complete: onComplete });
  });
};
