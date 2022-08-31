import { logger } from '../logger';
import chalk from 'chalk';
import { IBuildCmd } from './cmd-options';

export const printAffected = (cmd: IBuildCmd): { rev1: string, rev2: string } | undefined => {
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
