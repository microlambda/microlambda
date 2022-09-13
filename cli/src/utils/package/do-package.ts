import { IRunCommandErrorEvent, RunCommandEvent, RunCommandEventEnum, Runner } from '@microlambda/runner-core';
import { Packager } from '@microlambda/core';
import chalk from 'chalk';
import { logger } from '../logger';
import { IPackageOptions } from './options';
import { printError } from '../print-process-error';
import { EventsLog } from '@microlambda/logger';
import { MilaSpinnies } from '../spinnies';

export const packageServices = (options: IPackageOptions, eventsLog?: EventsLog): Promise<{ failures: Set<RunCommandEvent>, success: Set<RunCommandEvent> }> => {
  return new Promise((resolve, reject) => {
    logger.lf();
    logger.info('▼ Packaging services');
    logger.lf();
    const log = eventsLog?.scope('do-package');
    const success: Set<RunCommandEvent> = new Set();
    const failures: Set<IRunCommandErrorEvent> = new Set();
    const spinnies = new MilaSpinnies(options.verbose);
    const onNext = (evt: RunCommandEvent): void => {
      switch (evt.type) {
        case RunCommandEventEnum.NODE_STARTED: {
          log?.debug('Packaging process started', evt.workspace.name);
          spinnies.add(evt.workspace.name, `Packaging ${evt.workspace.name}`);
          break;
        }
        case RunCommandEventEnum.NODE_PROCESSED: {
          log?.debug('Packaging process Finished', evt.workspace.name);
          const metadata = Packager.readMetadata(evt.workspace);
          log?.debug('Metadata', metadata);
          success.add(evt);
          const usesLayer = metadata.megabytes?.layer;
          const codeSize = metadata.megabytes?.code || metadata.megabytes;
          log?.debug(spinnies);
          spinnies.succeed(evt.workspace.name, `${evt.workspace.name} packaged ${chalk.cyan(codeSize + 'MB')}${
            usesLayer ? chalk.cyan(` (using ${metadata.megabytes?.layer + 'MB'} layer)`) : ''
          } ${chalk.gray(metadata.took + 'ms')} ${evt.result.fromCache ? chalk.gray('(from cache)') : ''}`);
          break;
        }
        case RunCommandEventEnum.NODE_ERRORED: {
          log?.debug('Packaging process errored', evt.workspace.name);
          failures.add(evt);
          log?.debug(spinnies);
          spinnies.fail(evt.workspace.name, `Failed to package ${evt.workspace.name}`);
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
    const runner = new Runner(options.project, options.concurrency, eventsLog);
    runner.runCommand({
      cmd: 'package',
      workspaces: options.workspaces,
      mode: 'parallel',
      force: options.force || options.forcePackage,
      stdio: spinnies.stdio,
    }).subscribe({ next: onNext, error: onError, complete: onComplete });
  });
};
