import { Project } from '@microlambda/core';
import chalk from 'chalk';
import Spinnies from 'spinnies';
import {
  Runner,
  RunCommandEvent,
  RunCommandEventEnum,
  Workspace as CentipodWorkspace,
  isNodeEvent, isProcessError
} from "@microlambda/runner-core";
import { spinniesOptions } from "../utils/spinnies";
import { EventsLog, EventLogsFileHandler } from "@microlambda/logger";
import { resolveProjectRoot } from '@microlambda/utils';
import { logger } from '../utils/logger';
import { init } from '../utils/init';

export interface IBuildCmd {
  s?: string;
  install?: boolean;
  only: boolean;
  affected?: string;
  force?: boolean;
}

export interface IBuildOptions {
  project: Project;
  service: CentipodWorkspace | undefined;
  force: boolean;
  affected: { rev1: string, rev2: string } | undefined;
}

export const printCommand = (action: string, service?: string, only = true) => {
  if (service) {
    if (only) {
      logger.info('🔧 Building only', service);
    } else {
      logger.info('🔧 Building', service, 'and its dependencies');
    }
  } else {
    logger.info('🔧 Building all project services');
  }
}

const printAffected = (cmd: IBuildCmd): { rev1: string, rev2: string } | undefined => {
  const resolveAffected = (): { rev1: string, rev2: string } | undefined => {
    if (cmd.affected) {
      const revisions = cmd.affected.split('..');
      if (revisions.length != 2) {
        logger.error(chalk.red('Argument --affected must be formatted <rev1>..<rev2>'));
        process.exit(1);
      }
      return { rev1: revisions[0], rev2: revisions[1] };
    }
    return undefined;
  }
  const affected = resolveAffected();
  if (affected) {
    logger.info('');
    logger.info(chalk.magenta('> Skipping workspaces not affected affected between revisions', affected.rev1, 'and', affected.rev2));
  }
  logger.info('');
  return affected;
}

export const beforeBuild = async (
  projectRoot: string,
  cmd: IBuildCmd,
  eventsLog: EventsLog,
  acceptPackages = false,
): Promise<IBuildOptions> => {
  const affected = printAffected(cmd);
  const { project } = await init(projectRoot, eventsLog);
  const resolveService = (): CentipodWorkspace | undefined => {
    if (cmd.s) {
      const nodes = acceptPackages ? project.workspaces : project.services;
      const service = nodes.get(cmd.s);
      if (cmd.s && !service) {
        logger.error(chalk.red(acceptPackages ? 'Unknown workspace' : 'Unknown service', cmd.s));
        process.exit(1);
      }
      return service;
    }
    return undefined;
  }
  return { project, service: resolveService(), force: cmd.force || false, affected: affected };
};

export const printError = (error: unknown, spinners?: Spinnies, workspace?: string): void => {
  if (isNodeEvent(error)) {
    spinners?.fail(error.workspace.name, {text: `Error compiling ${error.workspace.name}`});
    printError(error.error, spinners, error.workspace.name);
  } else if (isProcessError(error) && error.all) {
    if (workspace) {
      logger.error(`${chalk.bold.red(`Command ${error.command} failed for workspace ${workspace} :`)}\n`);
    } else {
      logger.error(`${chalk.bold.red(`Command ${error.command} failed :`)}\n`);
    }
    logger.error(error.all);
  } else {
    logger.error(error);
  }
};

export const typeCheck = async (options: IBuildOptions): Promise<void> => {
  const spinnies = new Spinnies(spinniesOptions);
  const inProgress = new Set<string>();
  return new Promise<void>((resolve, reject) => {
    const onNext = (evt: RunCommandEvent): void => {
      if (evt.type === RunCommandEventEnum.TARGETS_RESOLVED) {
        if (!evt.targets.some((target) => target.hasCommand)) {
          logger.error(chalk.red('No workspace found for target build. Please add a build script in mila.json'));
        }
      } else if (evt.type === RunCommandEventEnum.NODE_SKIPPED && !evt.affected) {
        logger.info(chalk.bold.yellow('-'), 'Skipped', evt.workspace.name, chalk.grey('(unaffected)'))
      } else if (evt.type === RunCommandEventEnum.NODE_STARTED) {
        spinnies.add(evt.workspace.name, {text: `Compiling ${evt.workspace.name}` });
        inProgress.add(evt.workspace.name);
      } else if (evt.type === RunCommandEventEnum.NODE_PROCESSED) {
        inProgress.delete(evt.workspace.name);
        spinnies.succeed(evt.workspace.name, {
          text: `${evt.workspace.name} compiled ${chalk.cyan(evt.result.overall + 'ms')}${evt.result.fromCache ? chalk.grey(' (from cache)') : ''}`,
        });
      } else if (evt.type === RunCommandEventEnum.NODE_ERRORED) {
        inProgress.delete(evt.workspace.name);
        spinnies.fail(evt.workspace.name, {
          text: `Error compiling ${evt.workspace.name}`,
        });
        inProgress.forEach((w) => spinnies.update(w, { text: `${chalk.bold.yellow('-')} Compilation aborted ${w}`}));
        spinnies.stopAll();
        logger.error(`\n${chalk.bold.red('> Error details:')}\n`);
        printError(evt.error)
        return reject();
      }
    };
    const onError = (err: unknown): void => {
      inProgress.forEach((w) => spinnies.update(w, { text: `${chalk.bold.yellow('-')} Compilation aborted ${w}`}));
      spinnies.stopAll();
      logger.error(`\n${chalk.bold.red('> Error details:')}\n`);
      printError(err, spinnies)
      return reject();
    };
    const onComplete = (): void => {
      return resolve();
    };
    const runner = new Runner(options.project);
    runner.runCommand({
      cmd: 'build',
      to: options.service ? [options.service] : undefined,
      mode: 'topological',
      force: options.force,
    }).subscribe({ next: onNext, error: onError, complete: onComplete });
  });
};

export const build = async (cmd: IBuildCmd): Promise<void> => {
  printCommand('🔧 Building', cmd.s, cmd.only);
  const projectRoot = resolveProjectRoot();
  const eventsLog = new EventsLog(undefined, [new EventLogsFileHandler(projectRoot, `mila-build-${Date.now()}`)]);
  const options = await beforeBuild(projectRoot, cmd, eventsLog, true);
  try {
    await typeCheck(options);
    logger.info('\nSuccessfully built ✨');
    process.exit(0);
  } catch (e) {
    process.exit(1);
  }
};
