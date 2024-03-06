import { Project } from './graph/project';
import { EventsLog } from '@microlambda/logger';
import ora from 'ora';
import { command } from 'execa';
import { IBaseLogger } from '@microlambda/types';

export const yarnInstall = async (project: Project, logger?: IBaseLogger, eventsLog?: EventsLog): Promise<void> => {
  const installing = logger ? ora('Installing dependencies 📦').start() : undefined;
  try {
    await command('yarn install', {
      cwd: project.root,
      stdio: process.env.MILA_DEBUG?.split(',').includes('yarn') ? 'inherit' : 'pipe',
    });
  } catch (e) {
    const message =
      'Error installing microservices dependencies. Run in verbose mode (export MILA_DEBUG=yarn) for more infos.';
    eventsLog?.scope('bootstrap').error(e);
    eventsLog?.scope('bootstrap').error(message);
    logger?.error('\n' + message);
    process.exit(1);
  }
  if (installing) {
    installing.text = 'Dependencies installed 📦';
    installing.succeed();
  }
};
