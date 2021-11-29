/* eslint-disable no-console */
import {getDefaultThreads, getThreads, Logger, Packager } from '@microlambda/core';
import {beforeBuild, IBuildCmd, IBuildOptions, typeCheck} from './build';
import chalk from 'chalk';
import Spinnies from 'spinnies';
import {printReport} from './deploy';
import {RunCommandEvent, RunCommandEventEnum, Runner, Workspace as CentipodWorkspace} from "@centipod/core";

export interface IPackageCmd extends IBuildCmd {
  C: string;
  level: number;
  recompile: boolean;
}

interface IPackageOptions extends IBuildOptions {
  concurrency: number;
  targets: CentipodWorkspace[];
}

export const beforePackage = async (
  cmd: IPackageCmd,
  logger: Logger,
): Promise<IPackageOptions> => {
  const concurrency = cmd.C ? getThreads(Number(cmd.C)) : getDefaultThreads();
  const options = await beforeBuild(cmd, logger, false);
  if (cmd.recompile) {
    try {
      console.info('\nBuilding dependency graph\n');
      await typeCheck(options);
    } catch (e) {
      process.exit(1);
    }
  }
  return { ...options, concurrency, targets: options.service ? [options.service] : Array.from(options.project.services.values()) };
};

export const packageServices = (options: IPackageOptions): Promise<Set<RunCommandEvent>> => {
  return new Promise<Set<RunCommandEvent>>((resolve, reject) => {
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
          spinnies.succeed(evt.workspace.name, {
            text: `${evt.workspace.name} packaged ${chalk.cyan(metadata.megabytes?.code + 'MB')}${
              metadata.megabytes?.layer ? chalk.cyan(` (using ${metadata.megabytes?.layer + 'MB'} layer)`) : ''
            } ${chalk.gray(metadata.took + 'ms')}`,
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
        console.info('\nSuccessfully packaged 📦');
      } else {
        console.error('\nError packaging', failures.size, 'packages !');
      }
      return resolve(failures);
    };
    const runner = new Runner(options.project, options.concurrency);
    runner.runCommand('package', {
      to: options.service,
      mode: 'parallel',
      affected: options.affected,
      force: options.force,
    }).subscribe(onNext, onError, onComplete);
  });
};

export const packagr = async (cmd: IPackageCmd, logger: Logger): Promise<void> => {
  try {
    const options = await beforePackage(cmd, logger);
    console.info('\nPackaging services\n');
    const failures = await packageServices(options);
    if (failures.size) {
      await printReport(failures, options.service ? 1 : options.project.services.size, 'package');
      process.exit(1);
    }
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
};
