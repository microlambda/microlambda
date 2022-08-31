import { EventsLog } from '@microlambda/logger';
import { init } from '../init';
import { Workspace as CentipodWorkspace } from '@microlambda/runner-core';
import { logger } from '../logger';
import chalk from 'chalk';
import { IBuildCmd } from './cmd-options';
import { IBuildOptions } from './options';
import { printAffected } from './print-affected';

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
