import { Logger } from '../utils/logger';
import {
  IRecompilationError,
  IRecompilationEvent,
  RecompilationEventType,
  RecompilationScheduler,
} from '../utils/scheduler';
import { beforeBuild, IBuildCmd, typeCheck } from './build';
import chalk from 'chalk';
import Spinnies from "spinnies";
import { getDefaultThreads, getThreads } from '../utils/platform';
import { LernaGraph, Service } from '../lerna';

export interface IPackageCmd extends IBuildCmd {
  C: number;
  level: number;
  recompile: boolean;
}

export const beforePackage = async (cmd: IPackageCmd, scheduler: RecompilationScheduler, logger: Logger) => {
  const concurrency = cmd.C ? getThreads(Number(cmd.C)) : getDefaultThreads();
  const { projectRoot, graph, service } = await beforeBuild(cmd, scheduler, logger);
  const target = cmd.S ? service : graph;
  if (cmd.recompile) {
    try {
      console.info('\nBuilding dependency graph\n');
      await typeCheck(scheduler, target, cmd.onlySelf, false);
    } catch (e) {
      process.exit(1);
    }
  }
  return { projectRoot, concurrency, graph, service};
}

export const packageService = (scheduler: RecompilationScheduler, concurrency: number, target: Service | LernaGraph) => {
  return new Promise<void>((resolve, reject) => {
    const spinnies = new Spinnies({
      failColor: 'white',
      succeedColor: 'white',
      spinnerColor: 'cyan',
    });
    const onNext = (evt: IRecompilationEvent) => {
      switch (evt.type) {
        case RecompilationEventType.PACKAGE_IN_PROGRESS: {
          spinnies.add(evt.node.getName(), { text: `Packaging ${evt.node.getName()}` })
          break;
        }
        case RecompilationEventType.PACKAGE_SUCCESS: {
          spinnies.succeed(evt.node.getName(), { text: `${evt.node.getName()} packaged ${chalk.cyan(evt.megabytes + 'MB')} ${chalk.gray(evt.took + 'ms')}` })
          break;
        }
      }
    };
    const onError = async (evt: IRecompilationError) => {
      spinnies.fail(evt.node.getName(), { text: `Error packaging ${evt.node.getName()}` });
      spinnies.stopAll();
      console.log('\n');
      evt.logs.forEach(l => {
        console.info(chalk.bold(evt.node.getName()));
        console.log(chalk.red(l));
      });
      return reject(evt);
    };
    const onComplete = () => {
      return resolve();
    }
    scheduler.setConcurrency(concurrency);
    if (target instanceof Service) {
      scheduler.packageOne(target).subscribe(onNext, onError, onComplete);
    } else {
      scheduler.packageAll(target).subscribe(onNext, onError, onComplete);
    }
  });
}

export const packagr = async (cmd: IPackageCmd, logger: Logger, scheduler: RecompilationScheduler) => {

  try {
    const { concurrency, graph, service} = await beforePackage(cmd, scheduler, logger);
    console.info('\nPackaging services\n');
    await packageService(scheduler, concurrency, cmd.S ? service : graph);
    console.info('\nSuccessfully packaged 📦');
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
