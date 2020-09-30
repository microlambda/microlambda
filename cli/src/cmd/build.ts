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

export interface IBuildCmd {
  S?: string;
  bootstrap: boolean;
  onlySelf: boolean;
}

export const beforeBuild = async (cmd: IBuildCmd, scheduler: RecompilationScheduler, logger: Logger) => {
  const { graph } = await init(logger, scheduler);
  graph.enableAll();
  const service = graph.getServices().find(s => s.getName() === cmd.S)
  if (cmd.S && !service) {
    console.error(chalk.red('Unknown service', cmd.S));
    process.exit(1);
  }
  if (cmd.bootstrap) {
    await lernaBootstrap(graph, logger);
  }
  return { graph, service }
}

export const build = async (cmd: IBuildCmd, scheduler: RecompilationScheduler, logger: Logger) => {
  const { graph, service } = await beforeBuild(cmd, scheduler, logger);
  const spinners: Map<string, Ora> = new Map();
  const onNext = (evt: IRecompilationEvent) => {
    if (evt.type === RecompilationEventType.TYPE_CHECKING) {
      const spinner = ora(`Compiling ${evt.node.getName()}`);
      spinner.start();
      spinners.set(evt.node.getName(), spinner);
    } else if (evt.type === RecompilationEventType.TYPE_CHECKED) {
      const spinner = spinners.get(evt.node.getName());
      spinner.text = `${evt.node.getName()} compiled ${chalk.gray(evt.took + 'ms')}`;
      spinner.succeed();
    }
  };
  const onError = (evt: IRecompilationError) => {
    const spinner = spinners.get(evt.node.getName());
    spinner.fail(`Error compiling ${evt.node.getName()}`)
    evt.logs.forEach(l => console.error(l));
    process.exit(1);
  };
  const onComplete = () => {
    console.info('\nSuccessfully built ✨');
    process.exit(0);
  }
  if (cmd.S) {
    scheduler.buildOne(service, cmd.onlySelf).subscribe(onNext, onError, onComplete);
  } else {
    scheduler.buildAll(graph, cmd.onlySelf).subscribe(onNext, onError, onComplete);
  }
}