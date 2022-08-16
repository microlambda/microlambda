import { PublishActions } from "@microlambda/builder-core";
import { logger } from "../utils/logger";
import chalk from 'chalk';

export const printActions = (actions: PublishActions): void => {
  if (!actions.actions.length) {
    logger.info('Nothing to publish');
  }
  for (const action of actions.actions) {
    if (action.error) {
      if (action.currentVersion) {
        logger.info(action.workspace.name + ':', chalk.white.bold(action.currentVersion), '->', chalk.red.bold(action.error));
      } else {
        logger.info(action.workspace.name + ':', chalk.red.bold(action.error));
      }
    } else {
      if (action.targetVersion === action.currentVersion) {
        logger.info(action.workspace.name + ':', chalk.white.bold(action.currentVersion), action.changed ? '' : chalk.grey('[no changes]'));
      } else if (action.changed) {
        logger.info(action.workspace.name + ':', chalk.white.bold(action.currentVersion), '->', chalk.white.bold(action.targetVersion));
      } else {
        logger.info(action.workspace.name + ':', chalk.white.bold(action.currentVersion), '->', chalk.grey('[no changes]'));
      }
    }
  }
};
