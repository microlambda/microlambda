import { Logger } from '../utils/logger';
import {
  IRecompilationError,
  IRecompilationEvent,
  RecompilationErrorType,
  RecompilationEventType,
  RecompilationScheduler,
} from '../utils/scheduler';
import { beforeBuild, IBuildCmd } from './build';
import ora, { Ora } from 'ora';
import chalk from 'chalk';

interface IPackageCmd extends IBuildCmd {
  concurrency: number;
  level: number;
  recompile: boolean;
}

export const packagr = async (cmd: IPackageCmd, logger: Logger, scheduler: RecompilationScheduler) => {
  const { graph, service } = await beforeBuild(cmd, scheduler, logger);
  const spinners: Map<string, Ora> = new Map();
  const onNext = (evt: IRecompilationEvent) => {
    switch (evt.type) {
      case RecompilationEventType.TYPE_CHECKING: {
        const spinner = ora(`Compiling ${evt.node.getName()}`);
        spinner.start();
        spinners.set('compile.' + evt.node.getName(), spinner);
        break;
      }
      case RecompilationEventType.TYPE_CHECKED: {
        const spinner = spinners.get('compile.' + evt.node.getName());
        spinner.text = `${evt.node.getName()} compiled ${chalk.gray(evt.took + 'ms')}`;
        spinner.succeed();
        break;
      }
      case RecompilationEventType.PACKAGING: {
        const spinner = ora(`Packaging ${evt.node.getName()}`);
        spinner.start();
        spinners.set('package.' + evt.node.getName(), spinner);
        break;
      }
      case RecompilationEventType.PACKAGED: {
        const spinner = spinners.get('package.' + evt.node.getName());
        spinner.text = `${evt.node.getName()} packaged ${chalk.cyan(evt.megabytes + 'MB')} ${chalk.gray(evt.took + 'ms')}`;
        spinner.succeed();
        break;
      }
    }
  };
  const onError = (evt: IRecompilationError) => {
    const isCompiling = evt.type === RecompilationErrorType.TYPE_CHECK_ERROR;
    const prefix = isCompiling ? 'compile.' : 'package.';
    const spinner = spinners.get(prefix + evt.node.getName());
    spinner.fail(`Error ${isCompiling ? 'compiling' : 'packaging'} ${evt.node.getName()}`);
    evt.logs.forEach(l => console.error(l));
    process.exit(1);
  };
  const onComplete = () => {
    console.info('\nSuccessfully packaged 📦');
    process.exit(0);
  }
  if (cmd.S) {
    scheduler.packageOne(service, cmd.recompile).subscribe(onNext, onError, onComplete);
  } else {
    scheduler.packageAll(graph, cmd.recompile).subscribe(onNext, onError, onComplete);
  }
}
