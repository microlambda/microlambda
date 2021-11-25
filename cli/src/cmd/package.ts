/* eslint-disable no-console */
import {
  RecompilationScheduler,
  getDefaultThreads,
  getThreads,
  Logger,
  DependenciesGraph,
  Service,
  IPackageEvent,
} from '@microlambda/core';
import { beforeBuild, IBuildCmd, typeCheck } from './build';
import chalk from 'chalk';
import Spinnies from 'spinnies';
import { printReport } from './deploy';

export interface IPackageCmd extends IBuildCmd {
  C: string;
  level: number;
  recompile: boolean;
}

export const beforePackage = async (
  cmd: IPackageCmd,
  scheduler: RecompilationScheduler,
  logger: Logger,
): Promise<{ projectRoot: string; concurrency: number; services: Service[]; graph: DependenciesGraph }> => {
  const concurrency = cmd.C ? getThreads(Number(cmd.C)) : getDefaultThreads();
  const { projectRoot, graph } = await beforeBuild(cmd, scheduler, logger);
  const service = cmd.S ? graph.getServices().find((s) => s.getName() === cmd.S) : undefined;
  let services: Service[];
  let target: Service | DependenciesGraph;
  if (cmd.S) {
    if (!service) {
      console.error(chalk.red('Unknown service'), cmd.S);
      process.exit(1);
    }
    services = [service];
    target = service;
  } else {
    services = graph.getServices();
    target = graph;
  }
  if (cmd.recompile) {
    try {
      console.info('\nBuilding dependency graph\n');
      await typeCheck(scheduler, target, cmd.onlySelf, false);
    } catch (e) {
      process.exit(1);
    }
  }
  return { projectRoot, concurrency, services, graph };
};

export const packageServices = (
  scheduler: RecompilationScheduler,
  concurrency: number,
  target: Array<Service>,
): Promise<Set<IPackageEvent>> => {
  return new Promise<Set<IPackageEvent>>((resolve, reject) => {
    const failures: Set<IPackageEvent> = new Set();
    const spinnies = new Spinnies({
      failColor: 'white',
      succeedColor: 'white',
      spinnerColor: 'cyan',
    });
    const onNext = (evt: IPackageEvent): void => {
      switch (evt.type) {
        case 'started': {
          spinnies.add(evt.service.getName(), { text: `Packaging ${evt.service.getName()}` });
          break;
        }
        case 'succeeded': {
          spinnies.succeed(evt.service.getName(), {
            text: `${evt.service.getName()} packaged ${chalk.cyan(evt.megabytes?.code + 'MB')}${
              evt.megabytes?.layer ? chalk.cyan(` (using ${evt.megabytes?.layer + 'MB'} layer)`) : ''
            } ${chalk.gray(evt.took + 'ms')}`,
          });
          break;
        }
        case 'failed': {
          failures.add(evt);
          spinnies.fail(evt.service.getName(), {
            text: `Failed to package ${evt.service.getName()}`,
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
    scheduler.setConcurrency(concurrency);
    scheduler.package(target).subscribe(onNext, onError, onComplete);
  });
};

export const packagr = async (cmd: IPackageCmd, logger: Logger, scheduler: RecompilationScheduler): Promise<void> => {
  try {
    const { concurrency, services } = await beforePackage(cmd, scheduler, logger);
    console.info('\nPackaging services\n');
    const failures = await packageServices(scheduler, concurrency, services);
    if (failures.size) {
      await printReport(failures, services.length, 'package');
      process.exit(1);
    }
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
};
