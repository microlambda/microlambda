/* eslint-disable no-console */
import { EventsLog } from '@microlambda/logger';
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
import {resolveProjectRoot} from "@microlambda/utils";

export const generate = async (blueprint: string, logger: EventsLog): Promise<void> => {
  console.info('🧙 Microlambda code generator');
  const projectRoot = resolveProjectRoot();
  const log = logger.scope('generator');
  const blueprintsPath = join(projectRoot, 'blueprints');
  log.debug(`Resolving blueprints in ${blueprintsPath}`);
  const blueprints = await findBlueprints(blueprintsPath);
  log.debug(blueprints);
  let blueprintPath: string;
  if (blueprint) {
    const selected = Array.from(blueprints.keys()).find((path) => blueprints.get(path)?.name === blueprint);
    if (!selected) {
      throw new Error(`ENOTFOUND: Blueprint with name ${blueprint} not found`);
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
    log.debug(answers);
    blueprintPath = answers.blueprint;
  }
  const inputs = await resolveInputs(blueprintPath);
  log.debug(inputs);

  const interpolated = interpolateYaml(blueprints.get(blueprintPath), inputs);
  log.debug(interpolated);

  const templates = await findTemplates(join(blueprintPath, 'templates'));
  log.debug(templates.keys());

  const destinations = await resolveDestinations({
    blueprintPath,
    config: interpolated,
    inputs,
    templates,
    projectRoot,
  });
  log.debug(destinations);
  await renderTemplates(templates, destinations, inputs);
  destinations.forEach((created) => {
    console.info(chalk.green('[CREATED]'), relative(projectRoot, created));
  });
  await postProcessing(blueprintPath, inputs);
};
