import {
  isNodeEvent,
  isProcessError,
  isNodeErroredEvent,
  isNodeSucceededEvent,
  isTargetResolvedEvent,
  Project,
  Workspace,
  isDaemon, RunOptions, isSourceChangedEvent, isNodeInterruptingEvent, isNodeInterruptedEvent,
} from '@microlambda/runner-core';
import { resolveProjectRoot } from "@microlambda/utils";
import chalk from 'chalk';
import { logger } from "../utils/logger";
import { resolveWorkspace } from "../utils/validate-workspace";
import { EventLogsFileHandler, EventsLog } from '@microlambda/logger';
import {ConfigReader, getStateConfig, IStateConfig, verifyAccount} from '@microlambda/config';
import { aws } from '@microlambda/aws/lib';
import {verifyState} from "@microlambda/remote-state";

interface IRunCommandOptions {
  parallel: boolean;
  topological: boolean;
  watch?: boolean;
  reverse?: boolean;
  force?: boolean;
  to?: string;
  workspaces?: string;
  remoteCache?: boolean;
  affected?: string;
  debounce?: number;
  account?: string;
  stdio?: string;
}

const resolveCache = async (
  projectRoot: string,
  account?: string,
): Promise<IStateConfig> => {
  const config = (new ConfigReader(projectRoot)).rootConfig;
  const stateConfig = getStateConfig(config, account);
  await verifyState(stateConfig, logger);
  return stateConfig;
}

const mapToRunOptions = (
    cmd: string,
    options: IRunCommandOptions,
    project: Project,
    state?: IStateConfig,
  ): RunOptions => {
  if (options.parallel && options.topological) {
    logger.error('Conflict: incompatible options --parallel (-p) and --topological (-t)');
    process.exit(1);
  }
  if (options.parallel && options.to) {
    logger.error('Conflict: incompatible options --parallel (-p) and --to');
    process.exit(1);
  }
  if (!options.watch && options.debounce) {
    logger.info('Ignoring --debounce option as --watch mode is disabled.');
  }
  if (options.topological && options.workspaces) {
    logger.error('Conflict: incompatible options --topological (-t) and --workspaces (-w)');
    process.exit(1);
  }
  if (options.affected && !options.remoteCache) {
    logger.error('You must use remote cache to only run command on affected target since revision', options.affected);
    process.exit(1);
  }
  if (options.remoteCache && options.watch) {
    logger.error('Cannot using watch mode and remote caching simultaneously');
    process.exit(1);
  }

  const resolveWorkspaces = (names: string | undefined): Workspace[] | undefined => {
    if (!names) return undefined;
    const workspacesNames = names?.split(',') || [];
    return workspacesNames.map((name) => resolveWorkspace(project, name));
  }

  const remoteCache = options.remoteCache && state ? {
    bucket: state.state.checksums,
    table: state.state.table,
    region: state.defaultRegion,
  } : undefined;

  // NPM-style additional arguments
  let args: string[] = [];
  const argsSeparator = process.argv.indexOf('--');
  if (argsSeparator > -1) {
    args = process.argv.slice(argsSeparator + 1);
  }

  if (options.parallel) {
    if (options.watch) {
      return {
        cmd,
        mode: 'parallel',
        workspaces: resolveWorkspaces(options.workspaces),
        force: options.force || false,
        watch: options.watch,
        debounce: options.debounce,
        stdio: options.stdio === 'inherit' ? 'inherit' : 'pipe',
        args,
      }
    }
    return {
      cmd,
      mode: 'parallel',
      workspaces: resolveWorkspaces(options.workspaces),
      force: options.force || false,
      watch: false,
      remoteCache,
      affected: options.affected,
      stdio: options.stdio === 'inherit' ? 'inherit' : 'pipe',
      args,
    }
  } else {
    if (options.watch) {
      return {
        cmd,
        mode: 'topological',
        to: resolveWorkspaces(options.to),
        watch: options.watch,
        force: options.force || false,
        stdio: options.stdio === 'inherit' ? 'inherit' : 'pipe',
        debounce: options.debounce,
        reverse: options.reverse,
        args,
      }
    }
    return {
      cmd,
      mode: 'topological',
      to: resolveWorkspaces(options.to),
      force: options.force || false,
      watch: false,
      remoteCache,
      affected: options.affected,
      reverse: options.reverse,
      stdio: options.stdio === 'inherit' ? 'inherit' : 'pipe',
      args,
    };
  }
}

export const run = async (cmd: string, options: IRunCommandOptions): Promise<void> => {
  const projectRoot = resolveProjectRoot();
  const eventsLog = new EventsLog(undefined, [new EventLogsFileHandler(projectRoot, 'mila-runner-run-' + Date.now())]);
  const eventsLogger = eventsLog.scope('runner-cli/run');
  eventsLogger.info('Running command', cmd, options);
  const project =  await Project.loadProject(projectRoot, eventsLog);
  logger.lf();
  logger.info(logger.centipod, `Running command ${chalk.white.bold(cmd)}`, options.to ? `on project ${options.to}` : '');
  logger.seperator();
  const mode = options.parallel ? 'parallel' : 'topological';
  logger.info('Mode:', chalk.white.bold(mode));
  logger.info('Use caches:', chalk.white(!options.force));
  let config: IStateConfig | undefined;
  if (!options.force && options.remoteCache) {
    config = await resolveCache(projectRoot, options.account);
    const region = config.defaultRegion;
    const currentUser = await aws.iam.getCurrentUser(region);
    logger.seperator();
    logger.info('Using remote cache :');
    logger.info('AWS Account', chalk.white.bold(currentUser.projectId));
    logger.info('Cache location', chalk.white.bold(`s3://${config.state.checksums}`));
    logger.info('IAM user', chalk.white.bold(currentUser.arn));
    verifyAccount(currentUser, config);
  }
  logger.seperator();

  const printError = (error: unknown): void => {
    if (isNodeEvent(error)) {
      logger.lf();
      logger.info(logger.centipod, `Run target ${chalk.white.bold(cmd)} on ${chalk.white.bold(error.target.workspace.name)}`, logger.failed);
      printError(error.error);
    } else if (isProcessError(error) && !!error.all) {
      logger.lf();
      logger.info(chalk.cyan('>'), error.command);
      logger.lf();
      logger.log(error.all);
    } else {
      logger.error(error);
    }
  };
  const failures = new Set<Workspace>();
  const now = Date.now();
  let nbTargets = 0;

  project.runCommand(mapToRunOptions(cmd, options,  project, config)).subscribe({
      next: (event) => {
        if (isTargetResolvedEvent(event)) {
          if (!event.targets.some((target) => target.hasCommand)) {
            logger.lf();
            logger.error(logger.centipod, logger.failed, `No project found for command "${cmd}"`);
            logger.lf();
            process.exit(1);
          }
          logger.info('Targets resolved:');
          logger.info(event.targets.filter((t) => t.hasCommand).map((target) => `${' '.repeat(4)}- ${chalk.white.bold(target.workspace.name)}`).join('\n'));
          logger.seperator();
          nbTargets = event.targets.length;
        } else if (isNodeSucceededEvent(event)) {
          logger.lf();
          logger.info(logger.centipod, `Run target ${chalk.white.bold(cmd)} on ${chalk.white.bold(event.target.workspace.name)} ${logger.took(event.result.overall )} ${event.result.fromCache ? ( event.result.remoteCache ? logger.fromRemoteCache : logger.fromCache) : ''}`);
          for (const command of event.result.commands) {
            if (!isDaemon(command)) {
              logger.lf();
              logger.info(chalk.cyan('>'), command.command);
              logger.lf();
              if (command.all) {
                logger.log(command.all);
              } else {
                logger.info('Process exited with status', command.exitCode);
              }
            } else {
              logger.info('Demon started');
            }
          }
          logger.seperator();
        } else if (isNodeErroredEvent(event)) {
          logger.lf();
          logger.info(logger.centipod, `Run target ${chalk.white.bold(cmd)} on ${chalk.white.bold(event.target.workspace.name)} failed`);
          printError(event.error);
          failures.add(event.target.workspace);
        } else if (isSourceChangedEvent(event)) {
          logger.lf();
          logger.info(logger.centipod, `Sources changed for ${chalk.white.bold(event.target.workspace.name)}`);
          logger.lf();
          event.events.forEach((e) => logger.info(`* [${e.event}] ${e.path}`));
        } else if (isNodeInterruptingEvent(event)) {
          logger.lf();
          logger.info(logger.centipod, `Interrupting target ${chalk.white.bold(cmd)} on ${chalk.white.bold(event.target.workspace.name)}`);
          logger.lf();
          logger.info('PIDs:', event.pids.join(','));
        } else if (isNodeInterruptedEvent(event)) {
          logger.lf();
          logger.info(logger.centipod, `Interrupted target ${chalk.white.bold(cmd)} on ${chalk.white.bold(event.target.workspace.name)}`);
          logger.lf();
          logger.info('PIDs', event.pids.join(','));
        }
    },
    error: (err) => {
      printError(err);
      logger.error(logger.centipod, logger.failed, 'Command failed');
      process.exit(1)
    },
    complete: () => {
      logger.lf();
      const hasFailed = failures.size > 0;
      const status = hasFailed ? logger.failed : logger.success;
      logger.info(logger.centipod, status, chalk.bold[hasFailed ? 'redBright' : 'green'](`Run target "${cmd}" ${hasFailed ? 'failed ' : 'succeeded'} on ${hasFailed ? failures.size + '/' + nbTargets : nbTargets} packages`), logger.took(Date.now() - now));
      if (hasFailed) {
        logger.lf();
        logger.info('Failed packages:');
        logger.info(Array.from(failures).map((target) => `${' '.repeat(4)}- ${chalk.white.bold(target.name)}`).join('\n'));
      }
      process.exit(hasFailed ? 1 : 0);
    },
  });
}

