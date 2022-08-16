import { isCommittedEvent, isPublishedEvent, isPushedEvent, PublishEvent } from "@microlambda/builder-core";
import chalk from "chalk";
import { logger } from "./logger";

export const printEvent = (evt: PublishEvent): void => {
  if (isPublishedEvent(evt)) {
    logger.info(`Published ${chalk.white.bold(evt.action.workspace.name)}@${chalk.white.bold(evt.action.targetVersion)}`);
    logger.lf();
    logger.log(evt.output.stdout);
    logger.seperator();
  } else if (isCommittedEvent(evt)) {
    logger.info('Creating commit', chalk.white(evt.message));
  } else if (isPushedEvent(evt)) {
    logger.info('Pushing tags and release commit');
  }
}
