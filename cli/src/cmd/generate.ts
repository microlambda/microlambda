import { EventsLog, EventLogsFileHandler } from '@microlambda/logger';
import { join, relative } from 'path';
import { prompt } from 'inquirer';
import {
  findBlueprints,
  findTemplates,
  interpolateYaml,
  postProcessing,
  renderTemplates,
  resolveDestinations,
  resolveInputs,
} from '@microlambda/generators';
import chalk from 'chalk';
import { resolveProjectRoot } from '@microlambda/utils';
import { MilaError, MilaErrorCode } from '@microlambda/errors';
import { logger } from '../utils/logger';

export const generate = async (blueprint: string): Promise<void> => {
  logger.info('🧙 Microlambda code generator');
  const projectRoot = resolveProjectRoot();
  const eventsLog = new EventsLog(undefined, [new EventLogsFileHandler(projectRoot, `mila-generate-${Date.now()}`)]);
  const eventsLogger = eventsLog.scope('generator');
  const blueprintsPath = join(projectRoot, 'blueprints');
  eventsLogger.debug(`Resolving blueprints in ${blueprintsPath}`);
  const blueprints = await findBlueprints(blueprintsPath);
  eventsLogger.debug(blueprints);
  let blueprintPath: string;
  if (blueprint) {
    const selected = Array.from(blueprints.keys()).find((path) => blueprints.get(path)?.name === blueprint);
    if (!selected) {
      throw new MilaError(MilaErrorCode.BLUEPRINT_NOT_FOUND, `Blueprint with name ${blueprint} not found`);
    }
    blueprintPath = selected as string;
  } else {
    const answers = await prompt([
      {
        type: 'list',
        name: 'blueprint',
        message: 'What kind of entity do you want to generate ?',
        choices: Array.from(blueprints.entries()).map(([path, yaml]) => ({ name: yaml.name, value: path })),
      },
    ]);
    eventsLogger.debug(answers);
    blueprintPath = answers.blueprint;
  }
  const inputs = await resolveInputs(blueprintPath);
  eventsLogger.debug(inputs);

  const interpolated = interpolateYaml(blueprints.get(blueprintPath), inputs);
  eventsLogger.debug(interpolated);

  const templates = await findTemplates(join(blueprintPath, 'templates'));
  eventsLogger.debug(templates.keys());

  const destinations = await resolveDestinations({
    blueprintPath,
    config: interpolated,
    inputs,
    templates,
    projectRoot,
  });
  eventsLogger.debug(destinations);
  await renderTemplates(templates, destinations, inputs);
  destinations.forEach((created) => {
    logger.info(chalk.green('[CREATED]'), relative(projectRoot, created));
  });
  await postProcessing(blueprintPath, inputs);
};
