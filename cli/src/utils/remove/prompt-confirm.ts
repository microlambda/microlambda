import { logger } from '../logger';
import { prompt } from 'inquirer';
import chalk from 'chalk';

export const promptConfirm = async (
  env: string,
  cmd: { onlyPrompt: boolean; prompt: boolean },
  releaseLock: (msg?: string) => Promise<void>,
): Promise<void> => {
  if (cmd.onlyPrompt) {
    logger.info('Not performing destroy as --only-prompt option has been given');
    await releaseLock();
    process.exit(0);
  }
  if (cmd.prompt) {
    const answers = await prompt([
      {
        type: 'confirm',
        name: 'ok',
        message: `Are you sure you want to execute this remove on ${chalk.magenta.bold(env)}`,
      },
    ]);
    if (!answers.ok) {
      await releaseLock();
      process.exit(2);
    }
  }
};
