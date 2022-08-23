import {Packager } from '@microlambda/core';
import {beforeBuild, IBuildCmd, IBuildOptions, printCommand, typeCheck} from './build';
import chalk from 'chalk';
import Spinnies from 'spinnies';
import {printReport} from './deploy';
import {RunCommandEvent, RunCommandEventEnum, Runner, Workspace as CentipodWorkspace} from "@microlambda/runner-core";
import { EventsLog } from "@microlambda/logger";
import { getDefaultThreads, getThreads, resolveProjectRoot } from '@microlambda/utils';
import { EventLogsFileHandler } from '@microlambda/logger/lib';
import { logger } from '../utils/logger';

export interface IPackageCmd extends IBuildCmd {
  c: string;
  level: number;
  recompile: boolean;
  v: boolean;
}

interface IPackageOptions extends IBuildOptions {
  verbose: boolean;
  concurrency: number;
  targets: CentipodWorkspace[];
}

export const beforePackage = async (
  projectRoot: string,
  cmd: IPackageCmd,
  eventsLog: EventsLog,
): Promise<IPackageOptions> => {
  const concurrency = cmd.c ? getThreads(Number(cmd.c)) : getDefaultThreads();
  const options = await beforeBuild(projectRoot, cmd, eventsLog, false);
  if (cmd.recompile) {
    try {
      logger.info('\nBuilding dependency graph\n');
      await typeCheck(options);
    } catch (e) {
      process.exit(1);
    }
  }
  return { ...options, verbose: cmd.v, concurrency, targets: options.service ? [options.service] : Array.from(options.project.services.values()) };
};

export const packageServices = (options: IPackageOptions): Promise<{ failures: Set<RunCommandEvent>, success: Set<RunCommandEvent> }> => {
  return new Promise((resolve, reject) => {
    const success: Set<RunCommandEvent> = new Set();
    const failures: Set<RunCommandEvent> = new Set();
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
          spinnies.succeed(evt.workspace.name, {
            text: `${evt.workspace.name} packaged ${chalk.cyan(metadata.megabytes?.code + 'MB')}${
              metadata.megabytes?.layer ? chalk.cyan(` (using ${metadata.megabytes?.layer + 'MB'} layer)`) : ''
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
      }
      return resolve({ failures, success });
    };
    const runner = new Runner(options.project, options.concurrency);
    runner.runCommand('package', {
      workspaces: options.service ? [options.service] : undefined,
      mode: 'parallel',
      affected: options.affected,
      force: options.force,
      stdio: options.verbose ? 'inherit' : 'pipe',
    }).subscribe({ next: onNext, error: onError, complete: onComplete });
  });
};

export const packagr = async (cmd: IPackageCmd): Promise<void> => {
  try {
    printCommand('📦 Packaging', cmd.s, true);
    const projectRoot = resolveProjectRoot();
    const eventsLog = new EventsLog(undefined, [new EventLogsFileHandler(projectRoot, `mila-package-${Date.now()}`)]);
    const options = await beforePackage(projectRoot, cmd, eventsLog);
    logger.info('\nPackaging services\n');
    const { failures, success } = await packageServices(options);
    if (failures.size) {
      await printReport(success, failures, options.service ? 1 : options.project.services.size, 'package', options.verbose);
      process.exit(1);
    }
    process.exit(0);
  } catch (e) {
    logger.error(e);
    process.exit(1);
  }
};
