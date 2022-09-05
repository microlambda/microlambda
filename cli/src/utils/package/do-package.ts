import { IRunCommandErrorEvent, RunCommandEvent, RunCommandEventEnum, Runner } from '@microlambda/runner-core';
import Spinnies from 'spinnies';
import { Packager } from '@microlambda/core';
import chalk from 'chalk';
import { logger } from '../logger';
import { IPackageOptions } from './options';
import { printError } from '../print-process-error';

export const packageServices = (options: IPackageOptions): Promise<{ failures: Set<RunCommandEvent>, success: Set<RunCommandEvent> }> => {
  return new Promise((resolve, reject) => {
    logger.lf();
    logger.info('▼ Packaging services');
    logger.lf();
    const success: Set<RunCommandEvent> = new Set();
    const failures: Set<IRunCommandErrorEvent> = new Set();
    const spinnies = new Spinnies({
      failColor: 'white',
      succeedColor: 'white',
      spinnerColor: 'cyan',
    });
    const onNext = (evt: RunCommandEvent): void => {
      switch (evt.type) {
        case RunCommandEventEnum.NODE_STARTED: {
          spinnies.add(evt.workspace.name, { text: `Packaging ${evt.workspace.name}` });
          break;
        }
        case RunCommandEventEnum.NODE_PROCESSED: {
          const metadata = Packager.readMetadata(evt.workspace);
          success.add(evt);
          const usesLayer = metadata.megabytes?.layer;
          const codeSize = metadata.megabytes?.code || metadata.megabytes;
          spinnies.succeed(evt.workspace.name, {
            text: `${evt.workspace.name} packaged ${chalk.cyan(codeSize + 'MB')}${
              usesLayer ? chalk.cyan(` (using ${metadata.megabytes?.layer + 'MB'} layer)`) : ''
            } ${chalk.gray(metadata.took + 'ms')} ${evt.result.fromCache ? chalk.gray('(from cache)') : ''}`,
          });
          break;
        }
        case RunCommandEventEnum.NODE_ERRORED: {
          failures.add(evt);
          spinnies.fail(evt.workspace.name, {
            text: `Failed to package ${evt.workspace.name}`,
          });
          break;
        }
      }
    };
    const onError = async (error: unknown): Promise<void> => {
      spinnies.stopAll();
      return reject(error);
    };
    const onComplete = (): void => {
      if (!failures.size) {
        logger.info('\nSuccessfully packaged 📦');
      } else {
        logger.error('\nError packaging', failures.size, 'packages !');
        for (const fail of failures) {
          logger.error(`Failed to package`, fail.workspace.name);
          printError(fail.error);
        }
      }
      return resolve({ failures, success });
    };
    const runner = new Runner(options.project, options.concurrency);
    runner.runCommand({
      cmd: 'package',
      workspaces: options.workspaces,
      mode: 'parallel',
      force: options.force,
      stdio: options.verbose ? 'inherit' : 'pipe',
    }).subscribe({ next: onNext, error: onError, complete: onComplete });
  });
};
