/* eslint-disable no-console */
import {
  Logger,
  IRecompilationError,
  IRecompilationEvent,
  RecompilationEventType,
  RecompilationScheduler,
  DependenciesGraph,
  Node,
  Service,
} from '@microlambda/core';
import { init } from './start';
import chalk from 'chalk';
import ora, { Ora } from 'ora';

export interface IBuildCmd {
  S?: string;
  bootstrap: boolean;
  onlySelf: boolean;
}

export const beforeBuild = async (
  cmd: IBuildCmd,
  scheduler: RecompilationScheduler,
  logger: Logger,
  acceptPackages = false,
): Promise<{ projectRoot: string; graph: DependenciesGraph; service: Node | undefined }> => {
  const { graph, projectRoot } = await init(logger, scheduler);
  const nodes = acceptPackages ? graph.getNodes() : graph.getServices();
  const service = nodes.find((s) => s.getName() === cmd.S);
  if (cmd.S && !service) {
    console.error(chalk.red('Unknown service', cmd.S));
    process.exit(1);
  }
  // FIXME: Remove --no-bootstrap, put --re-install instead
  /*if (cmd.bootstrap) {
    await lernaBootstrap(graph, logger);
  }*/
  return { projectRoot, graph, service };
};

export const typeCheck = async (
  scheduler: RecompilationScheduler,
  target: DependenciesGraph | Node,
  onlySelf: boolean,
  force: boolean,
): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    const spinners: Map<string, Ora> = new Map();
    const onNext = (evt: IRecompilationEvent): void => {
      if (evt.type === RecompilationEventType.TYPE_CHECK_IN_PROGRESS) {
        const spinner = ora(`Compiling ${evt.node.getName()}`);
        spinner.start();
        spinners.set(evt.node.getName(), spinner);
      } else if (evt.type === RecompilationEventType.TYPE_CHECK_SUCCESS) {
        const spinner = spinners.get(evt.node.getName());
        if (spinner) {
          spinner.text = `${evt.node.getName()} compiled ${chalk.gray(evt.took + 'ms')}`;
          spinner.succeed();
        }
      } else if (evt.type === RecompilationEventType.TYPE_CHECK_FAILURE) {
        const spinner = spinners.get(evt.node.getName());
        if (spinner) {
          spinner.fail(`Error compiling ${evt.node.getName()}`);
        }
        (evt.node as Service).tscLogs.forEach((l) => console.error(l));
        return reject();
      }
    };
    const onError = (evt: IRecompilationError): void => {
      const spinner = spinners.get(evt.node.getName());
      if (spinner) {
        spinner.fail(`Error compiling ${evt.node.getName()}`);
      }
      evt.logs.forEach((l) => console.error(l));
      return reject();
    };
    const onComplete = (): void => {
      return resolve();
    };
    if (target instanceof Node) {
      scheduler.buildOne(target, onlySelf, force).subscribe(onNext, onError, onComplete);
    } else {
      scheduler.buildAll(target, onlySelf, force).subscribe(onNext, onError, onComplete);
    }
  });
};

export const build = async (cmd: IBuildCmd, scheduler: RecompilationScheduler, logger: Logger): Promise<void> => {
  const { graph, service } = await beforeBuild(cmd, scheduler, logger, true);
  try {
    await typeCheck(scheduler, service ? service : graph, cmd.onlySelf, true);
    console.info('\nSuccessfully built ✨');
    process.exit(0);
  } catch (e) {
    process.exit(1);
  }
};
