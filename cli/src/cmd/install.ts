import { npm, resolveProjectRoot } from '@microlambda/utils';
import { logger } from '../utils/logger';
import chalk from 'chalk';
import ora from 'ora';
import { command } from 'execa';
import { ConfigReader } from '@microlambda/config';
import { join } from 'path';
import { existsSync } from 'fs';

export const install = async (blueprint: string): Promise<void> => {
  if (!npm.packageExists(blueprint)) {
    logger.error(`Package ${chalk.bold(blueprint)} cannot be found on NPM`);
    process.exit(1);
  }
  const projectRoot = resolveProjectRoot();
  const install = ora(`📦 Installing ${blueprint}`).start();
  try {
    await command(`yarn add -D ${blueprint}`, { cwd: projectRoot, stdio: 'ignore' });
    install.succeed(`📦 Successfully installed ${blueprint}`);
  } catch (e) {
    install.fail(`📦 Error installing ${blueprint}`);
    logger.error(e);
    process.exit(1);
  }
  const blueprintName = blueprint.split('/');
  const blueprintPath = join(projectRoot, 'node_modules', ...blueprintName);
  if (!existsSync(join(blueprintPath, 'blueprint.yml'))) {
    logger.error(`${blueprint} is not a valid blueprint: missing blueprint.yml metadata`);
    process.exit(1);
  }
  const config = new ConfigReader(projectRoot);
  config.addInstalledBlueprint(blueprint);
  process.exit(0);
};
