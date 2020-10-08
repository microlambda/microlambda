import { Logger } from '../utils/logger';
import {
  IRecompilationError,
  IRecompilationEvent,
  RecompilationEventType,
  RecompilationScheduler,
} from '../utils/scheduler';
import { init, lernaBootstrap } from './start';
import chalk from 'chalk';
import ora, { Ora } from 'ora';
import { LernaGraph, Service } from '../lerna';

export interface IBuildCmd {
  S?: string;
  bootstrap: boolean;
  onlySelf: boolean;
}

export const beforeBuild = async (cmd: IBuildCmd, scheduler: RecompilationScheduler, logger: Logger) => {
  const { graph, projectRoot } = await init(logger, scheduler);
  graph.enableAll();
  const service = graph.getServices().find(s => s.getName() === cmd.S)
  if (cmd.S && !service) {
    console.error(chalk.red('Unknown service', cmd.S));
    process.exit(1);
  }
  if (cmd.bootstrap) {
    await lernaBootstrap(graph, logger);
  }
  return { projectRoot, graph, service }
}

export const typeCheck = async (scheduler: RecompilationScheduler, target: LernaGraph | Service, onlySelf: boolean, force: boolean): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    const spinners: Map<string, Ora> = new Map();
    const onNext = (evt: IRecompilationEvent) => {
      if (evt.type === RecompilationEventType.TYPE_CHECK_IN_PROGRESS) {
        const spinner = ora(`Compiling ${evt.node.getName()}`);
        spinner.start();
        spinners.set(evt.node.getName(), spinner);
      } else if (evt.type === RecompilationEventType.TYPE_CHECK_SUCCESS) {
        const spinner = spinners.get(evt.node.getName());
        spinner.text = `${evt.node.getName()} compiled ${chalk.gray(evt.took + 'ms')}`;
        spinner.succeed();
      } else if (evt.type === RecompilationEventType.TYPE_CHECK_FAILURE) {
        const spinner = spinners.get(evt.node.getName());
        spinner.fail(`Error compiling ${evt.node.getName()}`);
        (evt.node as Service).logs.forEach((l) => console.error(l));
        return reject();
      }
    };
    const onError = (evt: IRecompilationError) => {
      const spinner = spinners.get(evt.node.getName());
      spinner.fail(`Error compiling ${evt.node.getName()}`)
      evt.logs.forEach(l => console.error(l));
      return reject();
    };
    const onComplete = () => {
      return resolve();
    }
    if (target instanceof Service) {
      scheduler.buildOne(target, onlySelf, force).subscribe(onNext, onError, onComplete);
    } else {
      scheduler.buildAll(target, onlySelf, force).subscribe(onNext, onError, onComplete);
    }
  });
}

export const build = async (cmd: IBuildCmd, scheduler: RecompilationScheduler, logger: Logger) => {
  const { graph, service } = await beforeBuild(cmd, scheduler, logger);
  try {
    await typeCheck(scheduler, cmd.S ? service : graph, cmd.onlySelf, true);
    console.info('\nSuccessfully built ✨');
    process.exit(0);
  } catch (e) {
    process.exit(1);
  }
}
