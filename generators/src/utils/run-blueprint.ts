import { join, relative } from 'path';
import { interpolateYaml } from './interpolate-yaml';
import { findTemplates } from './find-templates';
import { resolveDestinations } from './destinations-resolver';
import { renderTemplates } from './ejs-renderer';
import { postProcessing } from './post-processing';
import { IBaseLogger } from '@microlambda/types';
import { resolveProjectRoot } from '@microlambda/utils';
import { findBlueprints } from './find-blueprints';
import chalk from 'chalk';
import { MilaError, MilaErrorCode } from '@microlambda/errors';
import { prompt } from 'inquirer';
import { resolveInputs } from './inputs-resolver';

export interface IGenerationLoggers {
  events: IBaseLogger;
  console: IBaseLogger;
}

export const runBlueprint = async (options: {
  blueprint?: string;
  inputs?: Record<string, unknown>;
  loggers?: IGenerationLoggers;
  projectRoot?: string;
}): Promise<void> => {
  const { blueprint, loggers } = options;
  let { inputs, projectRoot } = options;

  if (!projectRoot) {
    projectRoot = resolveProjectRoot();
  }
  const blueprintsPath = join(projectRoot, 'blueprints');
  loggers.events.debug(`Resolving blueprints in ${blueprintsPath}`);
  const blueprints = await findBlueprints(blueprintsPath);
  loggers.events.debug(blueprints);
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
    loggers.events.debug(answers);
    blueprintPath = answers.blueprint;
  }
  if (!inputs) {
    inputs = await resolveInputs(blueprintPath);
  }
  loggers.events.debug(inputs);

  const interpolated = interpolateYaml(blueprints.get(blueprintPath), inputs);
  loggers.events.debug(interpolated);

  const templates = await findTemplates(join(blueprintPath, 'templates'));
  loggers.events.debug(templates.keys());

  const destinations = await resolveDestinations({
    blueprintPath,
    config: interpolated,
    inputs,
    templates,
    projectRoot,
  });
  loggers.events.debug(destinations);
  await renderTemplates(templates, destinations, inputs);
  destinations.forEach((created) => {
    loggers.console.info(chalk.green('[CREATED]'), relative(projectRoot, created));
  });
  await postProcessing(blueprintPath, inputs, loggers);
};
