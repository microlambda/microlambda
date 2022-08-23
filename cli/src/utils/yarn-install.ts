import { Project } from '@microlambda/core';
import { EventsLog } from '@microlambda/logger';
import ora from 'ora';
import { command } from 'execa';
import { logger } from './logger';

export const yarnInstall = async (project: Project, eventsLog?: EventsLog): Promise<void> => {
  const installing = ora('Installing dependencies 📦').start();
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
    logger.lf();
    logger.error(message);
    process.exit(1);
  }
  installing.text = 'Dependencies installed 📦';
  installing.succeed();
};
