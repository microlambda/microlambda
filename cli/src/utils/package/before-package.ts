import { EventsLog } from '@microlambda/logger';
import { beforeBuild } from '../build/pre-requisites';
import { logger } from '../logger';
import { typeCheck } from '../build/type-check';
import { IPackageOptions } from './options';
import { IPackageCmd } from './cmd-options';
import { Project } from '@microlambda/core';
import chalk from "chalk";

export const beforePackage = async (
  project: string | Project,
  cmd: IPackageCmd,
  eventsLog: EventsLog,
): Promise<IPackageOptions> => {
  const options = await beforeBuild(project, cmd, eventsLog, false);
  if (cmd.recompile) {
    try {
      logger.lf();
      logger.info(chalk.bold.underline('▼ Building dependency graph'));
      logger.lf();
      await typeCheck(options);
    } catch (e) {
      process.exit(1);
    }
  }
  return {
    ...options,
    verbose: cmd.verbose,
    forcePackage: cmd.forcePackage,
    install: cmd.install,
    recompile: cmd.recompile,
  };
};
