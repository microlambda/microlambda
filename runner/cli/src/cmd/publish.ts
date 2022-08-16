import { Project, resolveProjectRoot } from "@microlambda/runner-core";
import { logger } from "../utils/logger";
import { resolveWorkspace } from "../utils/validate-workspace";
import chalk from 'chalk';
import { createInterface } from "readline";
import { printActions } from "../utils/print-actions";
import { printEvent } from "../utils/print-publish-events";
import semver from 'semver';

export const publish = async (workspaceName: string, bump: semver.ReleaseType, identifier: string | undefined, options: { yes: boolean, access: string, dry: boolean }): Promise<void> => {
  const project =  await Project.loadProject(resolveProjectRoot());
  const workspace = resolveWorkspace(project, workspaceName);
  logger.lf();
  logger.info(logger.centipod, `Publishing ${chalk.white.bold(workspace.name)}`);
  logger.seperator();
  logger.info('Upgrade type:', chalk.white.bold(bump));
  if (identifier) {
    logger.info('Identifier:', chalk.white.bold(identifier));
  }
  logger.seperator();
  // TODO: Factorise with semantic-release
  const actions = await workspace.bumpVersions(bump, identifier);
  printActions(actions);
  logger.seperator();
  if (actions.actions.filter((a) => a.error).length) {
    logger.info('Cannot publish packages, errors were found when preparing releases');
    process.exit(1);
  }
  if (!actions.actions.filter((a) => a.changed).length) {
    logger.info('Nothing to publish');
    process.exit(0);
  }
  const doPublish = (): void => {
    workspace.publish({
      access: options.access || 'public',
      dry: options.dry,
    }).subscribe({
      next: (evt) => printEvent(evt),
      error: (err) => {
        logger.error(err);
        process.exit(1);
      },
      complete: () => {
        logger.info(logger.centipod, logger.success, chalk.green.bold(`Successfully published package ${workspaceName} and its dependencies`));
        process.exit(0);
      },
    });
  }
  if (options.yes) {
    doPublish();
  } else {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.question('Do you want to publish (y/N) ? ', (confirm) => {
      if (confirm === 'y' || confirm === 'yes') {
        logger.seperator();
        doPublish();
      } else {
        logger.error('\nAborted by user');
        process.exit(1);
      }
    });
  }
};
