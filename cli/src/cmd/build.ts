/* eslint-disable no-console */
import { Logger, Project } from '@microlambda/core';
import { init, yarnInstall } from './start';
import chalk from 'chalk';
import ora, { Ora } from 'ora';
import {
  Runner,
  RunCommandEvent,
  RunCommandEventEnum,
  Workspace as CentipodWorkspace,
  isNodeEvent, isProcessError
} from "@centipod/core";

export interface IBuildCmd {
  S?: string;
  reInstall?: boolean;
  affected?: string;
  force?: boolean;
}

export interface IBuildOptions {
  projectRoot: string;
  project: Project;
  service: CentipodWorkspace | undefined;
  force: boolean;
  affected: { rev1: string, rev2: string } | undefined;
}

export const beforeBuild = async (
  cmd: IBuildCmd,
  logger: Logger,
  acceptPackages = false,
): Promise<IBuildOptions> => {
  const { project, projectRoot } = await init(logger);
  const resolveService = (): CentipodWorkspace | undefined => {
    if (cmd.S) {
      const nodes = acceptPackages ? project.workspaces : project.services;
      const service = nodes.get(cmd.S);
      if (cmd.S && !service) {
        console.error(chalk.red(acceptPackages ? 'Unknown workspace' : 'Unknown service', cmd.S));
        process.exit(1);
      }
      return service;
    }
    return undefined;
  }
  if (cmd.reInstall) {
    await yarnInstall(project, logger);
  }
  const resolveAffected = (): { rev1: string, rev2: string } | undefined => {
    if (cmd.affected) {
      const revisions = cmd.affected.split('..');
      if (revisions.length != 2) {
        console.error(chalk.red('Argument --affected must be formatted <rev1>..<rev2>'));
        process.exit(1);
      }
      return { rev1: revisions[0], rev2: revisions[1] };
    }
    return undefined;
  }
  return { projectRoot, project, service: resolveService(), force: cmd.force || false, affected: resolveAffected() };
};

export const printError = (error: unknown): void => {
  if (isNodeEvent(error)) {
    printError(error.error);
  } else if (isProcessError(error)) {
    console.log(error.all);
  } else {
    console.error(error);
  }
};

export const typeCheck = async (options: IBuildOptions): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    const spinners: Map<string, Ora> = new Map();
    const onNext = (evt: RunCommandEvent): void => {
      if (evt.type === RunCommandEventEnum.NODE_STARTED) {
        const spinner = ora(`Compiling ${evt.workspace.name}`);
        spinner.start();
        spinners.set(evt.workspace.name, spinner);
      } else if (evt.type === RunCommandEventEnum.NODE_PROCESSED) {
        const spinner = spinners.get(evt.workspace.name);
        if (spinner) {
          spinner.text = `${evt.workspace.name} compiled ${chalk.gray(evt.result.overall + 'ms')}`;
          spinner.succeed();
        }
      } else if (evt.type === RunCommandEventEnum.NODE_ERRORED) {
        const spinner = spinners.get(evt.workspace.name);
        if (spinner) {
          spinner.fail(`Error compiling ${evt.workspace.name}`);
        }
        printError(evt.error);
        return reject();
      }
    };
    const onError = (err: unknown): void => {
      printError(err);
      return reject();
    };
    const onComplete = (): void => {
      return resolve();
    };
    const runner = new Runner(options.project);
    runner.runCommand('build', {
      to: options.service,
      parallel: false,
      affected: options.affected,
      force: options.force,
    }).subscribe(onNext, onError, onComplete);
  });
};

export const build = async (cmd: IBuildCmd, logger: Logger): Promise<void> => {
  const options = await beforeBuild(cmd, logger, true);
  try {
    await typeCheck(options);
    console.info('\nSuccessfully built ✨');
    process.exit(0);
  } catch (e) {
    process.exit(1);
  }
};
