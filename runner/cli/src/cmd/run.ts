import {
  isNodeEvent,
  isProcessError,
  isNodeErroredEvent,
  isNodeSucceededEvent,
  isTargetResolvedEvent,
  Project,
  Workspace,
  isDaemon
} from "@microlambda/runner-core";
import { resolveProjectRoot } from "@microlambda/utils";
import chalk from 'chalk';
import { logger } from "../utils/logger";
import { resolveWorkspace } from "../utils/validate-workspace";
import { EventLogsFileHandler, EventsLog } from '@microlambda/logger';

export const run = async (cmd: string, options: {parallel: boolean, topological: boolean, watch?: boolean, force: boolean, to?: string, affected?: string}): Promise<void> => {
  // TODO: Validate options (conflict between parallel/topological, watch/affected)
  const projectRoot = resolveProjectRoot();
  const eventsLog = new EventsLog(undefined, [new EventLogsFileHandler(projectRoot, 'mila-runner-run-' + Date.now())]);
  const eventsLogger = eventsLog.scope('runner-cli/run');
  eventsLogger.info('Running command', cmd, options);
  const project =  await Project.loadProject(projectRoot, eventsLog);
  const to = options.to ? resolveWorkspace(project, options.to) : undefined;
  logger.lf();
  logger.info(logger.centipod, `Running command ${chalk.white.bold(cmd)}`, options.to ? `on project ${options.to}` : '');
  logger.seperator();
  const mode = options.parallel ? 'parallel' : 'topological';
  logger.info('Mode:', chalk.white.bold(mode));
  logger.info('Use caches:', chalk.white(!options.force));
  const affected = options.affected?.split('..');
  let revisions: { rev1: string, rev2: string } | undefined;
  if (affected?.length) {
    const rev1 = affected?.length === 2 ? affected[0] : 'HEAD';
    const rev2 = affected?.length === 2 ? affected[1] : affected[0];
    logger.info('Only affected packages between', chalk.white.bold(rev1, '->', rev2));
    revisions = { rev1, rev2 };
  }
  logger.seperator();

  const printError = (error: unknown): void => {
    if (isNodeEvent(error)) {
      logger.lf();
      logger.info(logger.centipod, `Run target ${chalk.white.bold(cmd)} on ${chalk.white.bold(error.workspace.name)}`, logger.failed);
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

  const runOptions =  options.parallel ? {
    mode: 'parallel' as const, force: options.force, affected: revisions, workspaces: to ? [to] : undefined,
  } : {
    mode: 'topological' as const, force: options.force, affected: revisions, to: to ? [to] : undefined,
  };

  project.runCommand(cmd, runOptions).subscribe({
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
          logger.info(logger.centipod, `Run target ${chalk.white.bold(cmd)} on ${chalk.white.bold(event.workspace.name)} ${logger.took(event.result.overall )} ${event.result.fromCache ? logger.fromCache : ''}`);
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
          logger.info(logger.centipod, `Run target ${chalk.white.bold(cmd)} on ${chalk.white.bold(event.workspace.name)} failed`);
          printError(event.error);
          failures.add(event.workspace);
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
