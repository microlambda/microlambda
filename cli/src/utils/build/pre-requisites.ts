import { EventsLog } from '@microlambda/logger';
import { init } from '../init';
import { Workspace as CentipodWorkspace } from '@microlambda/runner-core';
import { logger } from '../logger';
import chalk from 'chalk';
import { IBuildCmd } from './cmd-options';
import { IBuildOptions } from './options';
import { Project } from '@microlambda/core';

export const beforeBuild = async (
  _project: string | Project,
  cmd: IBuildCmd,
  eventsLog: EventsLog,
  acceptPackages = false,
): Promise<IBuildOptions> => {
  let project: Project;
  if (typeof _project === 'string') {
    project = (await init(_project, eventsLog, cmd.install)).project;
  } else {
    project = _project;
  }
  const resolveWorkspaces = (): CentipodWorkspace[] => {
    if (cmd.s) {
      const nodes = acceptPackages ? project.workspaces : project.services;
      const targets = cmd.s.split(',');
      return targets.map((t) => {
        const workspace = nodes.get(t);
        if (!workspace) {
          logger.error(chalk.red(acceptPackages ? 'Unknown workspace' : 'Unknown service', cmd.s));
          process.exit(1);
        }
        return workspace;
      })
    }
    return [...project.services.values()];
  }
  return {project, workspaces: resolveWorkspaces(), force: cmd.force || process.env.MILA_FORCE === 'true', install: cmd.install, verbose: cmd.verbose };
};
