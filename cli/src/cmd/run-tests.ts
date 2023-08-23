import { ITestCommand } from '../utils/test/cmd-options';
import { resolveProjectRoot } from '@microlambda/utils';
import { EventLogsFileHandler, EventsLog } from '@microlambda/logger';
import { beforeBuild } from '../utils/build/pre-requisites';
import { ITestOptions } from '../utils/test/options';
import { getConcurrency } from '../utils/get-concurrency';
import {
  checkWorkingDirectoryClean,
  IRemoteCacheRunOptions,
  IRunCommandErrorEvent,
  isNotDaemon,
  RunCommandEvent,
  RunCommandEventEnum,
  Runner,
  RunOptions,
  currentSha1,
} from '@microlambda/runner-core';
import { MilaSpinnies } from '../utils/spinnies';
import { logger } from '../utils/logger';
import { printError } from '../utils/print-process-error';
import { printReport } from '../utils/deploy/print-report';
import { ConfigReader } from '@microlambda/config';
import { State } from '@microlambda/remote-state';
import { execSync } from 'child_process';
import { from, Observable } from 'rxjs';
import { map, mergeAll } from 'rxjs/operators';
import chalk from 'chalk';
import { printAccountInfos } from './envs/list';
import { typeCheck } from '../utils/build/type-check';

export const runTests = async (cmd: ITestCommand): Promise<void> => {
  try {
    logger.info('Running tests ✅');
    logger.lf();

    const projectRoot = resolveProjectRoot();
    const eventsLog = new EventsLog(undefined, [new EventLogsFileHandler(projectRoot, `mila-test-${Date.now()}`)]);
    const options: ITestOptions = {
      ...(await beforeBuild(projectRoot, cmd, eventsLog, true)),
      concurrency: getConcurrency(cmd.c),
      remoteCache: cmd.remoteCache,
      affectedSince: cmd.affectedSince,
      verbose: cmd.verbose,
    };

    let currentBranch: string;
    if (cmd.remoteCache) {
      logger.lf();
      logger.info('☁️  Using remote cache');
      await printAccountInfos();
      checkWorkingDirectoryClean();
      if (cmd.remoteCache && !cmd.affectedSince) {
        try {
          currentBranch = execSync('git branch --show-current').toString().split('\n')[0];
          if (!currentBranch) {
            logger.error(
              'Cannot determine current branch, you are probably in detached HEAD state. You cannot use remote caching on detached HEAD state without giving a value for option --affectedSince',
            );
            process.exit(1);
          }
          logger.info('Current branch:', chalk.cyan.bold(currentBranch));
        } catch (e) {
          logger.error('Cannot determine current branch', e);
          process.exit(1);
        }
      }
      logger.lf();
    }

    const config = new ConfigReader(projectRoot, eventsLog).rootConfig;
    const state = new State(config);

    await typeCheck(options);

    const { failures, success } = await new Promise(async (resolve, reject) => {
      const log = eventsLog.scope('run-tests');
      const success: Set<RunCommandEvent> = new Set();
      const failures: Set<IRunCommandErrorEvent> = new Set();
      const spinnies = new MilaSpinnies(options.verbose);
      const saveExecutions$: Array<Promise<void>> = [];
      const onNext = (next: { evt: RunCommandEvent; runOptions: RunOptions }): void => {
        let affectedInfos = '';
        if (
          (next.runOptions as IRemoteCacheRunOptions).remoteCache &&
          (next.runOptions as IRemoteCacheRunOptions).affected
        ) {
          affectedInfos += ' affected since ';
          affectedInfos += (next.runOptions as IRemoteCacheRunOptions).affected;
          if (currentBranch) {
            affectedInfos += ` (branch ${currentBranch})`;
          }
        }
        switch (next.evt.type) {
          case RunCommandEventEnum.NODE_STARTED: {
            log?.debug('Testing process started', next.evt.target.workspace.name);
            spinnies.add(
              next.evt.target.workspace.name,
              `Testing ${next.evt.target.workspace.name}${chalk.magenta(affectedInfos)}`,
            );
            if (cmd.verbose) {
              logger.lf();
            }
            break;
          }
          case RunCommandEventEnum.NODE_PROCESSED: {
            log?.debug('Testing process Finished', next.evt.target.workspace.name);
            success.add(next.evt);
            log?.debug(spinnies);
            let fromCache = '';
            if (next.evt.result.remoteCache) {
              fromCache = ` ${chalk.cyan.bold('from remote cache')} -${affectedInfos}`;
            } else if (next.evt.result.fromCache) {
              fromCache = ' ' + chalk.cyan.bold('from local cache');
            }
            if (cmd.verbose && next.evt.result.fromCache) {
              next.evt.result.commands.forEach((cmdResult) => {
                if (isNotDaemon(cmdResult)) {
                  logger.info(chalk.grey('>'), chalk.grey(cmdResult.command));
                  logger.lf();
                  // eslint-disable-next-line no-console
                  console.log(cmdResult.all || 'No logs to show');
                }
              });
            }
            if (cmd.verbose) {
              logger.lf();
            }
            if (
              cmd.remoteCache &&
              next.evt.result.commands.every((cmdResult) => {
                if (isNotDaemon(cmdResult)) {
                  return cmdResult.exitCode === 0;
                }
                return false;
              })
            ) {
              logger.info('☁️  Caching results for next executions');
              try {
                let _currentBranch = currentBranch;
                if (!_currentBranch) {
                  _currentBranch = execSync('git branch --show-current').toString().split('\n')[0];
                }
                const sha1 = currentSha1();
                logger.info('Current sha1:', chalk.cyan.bold(sha1));
                if (currentBranch && sha1) {
                  saveExecutions$.push(
                    state.saveExecution({
                      service: next.evt.target.workspace.name,
                      branch: currentBranch,
                      cmd: 'test',
                      current_sha1: sha1,
                      region: config.defaultRegion,
                    }),
                  );
                }
              } catch (e) {
                logger.warn(
                  next.evt.target.workspace.name,
                  ':',
                  'Failed to cache results for next execution. Tests will be re-run next time.',
                );
              }
              logger.lf();
            }
            spinnies.succeed(
              next.evt.target.workspace.name,
              `${next.evt.target.workspace.name} tested${chalk.magenta(fromCache)}`,
            );
            break;
          }
          case RunCommandEventEnum.NODE_ERRORED: {
            log?.debug('Test process errored', next.evt.target.workspace.name);
            failures.add(next.evt);
            log?.debug(spinnies);
            spinnies.fail(next.evt.target.workspace.name, `Failed to test ${next.evt.target.workspace.name}`);
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
          logger.info('\nSuccessfully tested 📦');
        } else {
          logger.error('\nError testing', failures.size, 'packages !');
          for (const fail of failures) {
            logger.error(`Failed to test`, fail.target.workspace.name);
            printError(fail.error);
          }
        }
        Promise.all(saveExecutions$).then(() => {
          return resolve({ failures, success });
        });
      };

      const runner = new Runner(options.project, options.concurrency, eventsLog);

      const process$: Array<Observable<{ evt: RunCommandEvent; runOptions: RunOptions }>> = await Promise.all(
        options.workspaces.map(async (workspace) => {
          let remoteCache: { bucket: string; region: string } | undefined = undefined;
          let affected: string | undefined = undefined;
          if (options.remoteCache) {
            remoteCache = { bucket: config.state.checksums, region: config.defaultRegion };
            const lastTestExecution = await state.getExecution(
              options.affectedSince || currentBranch,
              'test',
              workspace.name,
            );
            if (lastTestExecution) {
              if (options.affectedSince) {
                logger.info('Running command if sources affected since', chalk.magenta(options.affectedSince));
                try {
                  const lastCommitOnTargetBranch = execSync(
                    `git log -n 1 --pretty=format:"%H" ${options.affectedSince}`,
                  ).toString();
                  logger.info('Last commit on branch', options.affectedSince, ':', lastCommitOnTargetBranch);
                  if (lastCommitOnTargetBranch === lastTestExecution.current_sha1) {
                    affected = lastTestExecution.current_sha1;
                  } else {
                    logger.info(
                      'Last cached execution (',
                      lastTestExecution.current_sha1,
                      ') is not up-to-date. Command will be re-run.',
                    );
                  }
                } catch (e) {
                  logger.warn('Unable to find last commit of target branch, remote caching will be ignored', e);
                }
              } else {
                affected = lastTestExecution.current_sha1;
              }
            }
          }
          const runOptions: RunOptions = {
            cmd: 'test',
            workspaces: [workspace],
            mode: 'parallel',
            force: options.force,
            stdio: spinnies.stdio,
            remoteCache,
            affected,
          };
          return runner.runCommand(runOptions).pipe(map((evt) => ({ evt, runOptions })));
        }),
      );

      from(process$)
        .pipe(mergeAll(options.concurrency))
        .subscribe({ next: onNext, error: onError, complete: onComplete });
    });
    if (failures.size) {
      await printReport(success, failures, options.workspaces.length, 'test', options.verbose);
      process.exit(1);
    }
    process.exit(0);
  } catch (e) {
    logger.error(e);
    process.exit(1);
  }
};
