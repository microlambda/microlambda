import {
  CentipodErrorCode,
  Project,
  resolveProjectRoot,
  semanticRelease as prepareRelease,
  hasSemanticReleaseTags,
  createSemanticReleaseTag,
  Publish,
  CentipodError,
} from '@microlambda/runner-core';
import { logger } from '../utils/logger';
import { printActions } from '../utils/print-actions';
import chalk from 'chalk';
import { createInterface } from 'readline';
import { printEvent } from '../utils/print-publish-events';

// TODO: move in utils
interface IPublishOptions {
  yes?: boolean;
  access?: string;
  dry?: boolean;
}

const printSummary = (publisher: Publish): void => {
  printActions(publisher.actions);
  logger.seperator();
  if (publisher.actions.actions.filter((a) => a.error).length) {
    logger.lf();
    logger.info('Cannot publish packages, errors were found when preparing releases');
    process.exit(1);
  }
  if (!publisher.actions.actions.filter((a) => a.changed).length) {
    logger.lf();
    logger.info('Nothing to publish');
    process.exit(0);
  }
}

const doPublish = (publisher: Publish, options: IPublishOptions): void => {
  publisher.release({
    access: options.access,
    dry: options.dry || false,
  }).subscribe({
      next: (evt) => printEvent(evt),
      error: (err) => {
        logger.error(err);
        process.exit(1);
      },
      complete: async () => {
        await createSemanticReleaseTag();
        logger.lf();
        logger.info(logger.centipod, logger.success, chalk.green.bold(`Successfully initialized semantic release and published packages`, options.dry ? chalk.bgBlueBright.white(" DRY RUN ") : ""));
        process.exit(0);
      },
    },
  );
};

const promptPublishConfirmation = (publisher: Publish, options: IPublishOptions): void => {
  if (options.yes) {
    doPublish(publisher, options);
  } else {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.question('Do you want to publish (y/N) ? ', (confirm) => {
      if (confirm === 'y' || confirm === 'yes') {
        logger.seperator();
        doPublish(publisher, options);
      } else {
        logger.error('\nAborted by user');
        process.exit(1);
      }
    });
  }
}

export const semanticRelease  = async (identifier: string, options: IPublishOptions): Promise<void> => {
  // TODO: Throw if git working directory not cleaned
  // TODO: Enforce branch to main/next etc... Configure in some rc file
  const project =  await Project.loadProject(resolveProjectRoot());
  logger.lf();
  logger.info(logger.centipod, chalk.white.bold('Initializing new semantic-release update'));
  logger.seperator();
  try {
    logger.info('Based on conventional commit messages analysis, the following updates are advised :');
    logger.lf();
    const publisher = await prepareRelease(project, identifier);
    printSummary(publisher);
    promptPublishConfirmation(publisher, options);
  } catch (e) {
    switch ((e as CentipodError).code) {
      case CentipodErrorCode.NOTHING_TO_DO:
        logger.info('Nothing to do. Every packages are already up-to-date');
        process.exit(0);
        break
      case CentipodErrorCode.NO_SEMANTIC_RELEASE_TAGS_FOUND:
        logger.error('Previous semantic release tag could not be found. Have you initialized semantic-release with command "centipod semantic-release init <version>"');
        break
      default:
        logger.error(e);
        break;
    }
    process.exit(1);
  }
};

export const semanticReleaseInit  = async (options: IPublishOptions): Promise<void> => {
  const project =  await Project.loadProject(resolveProjectRoot());
  logger.lf();
  logger.info(logger.centipod, chalk.white.bold('Initializing semantic-release flow'));
  logger.seperator();
  const isAlreadyInitialized = await hasSemanticReleaseTags();
  if (isAlreadyInitialized) {
    logger.error('Semantic-release flow already initialized');
    process.exit(1);
  }
  try {
    const publisher = await project.publishAll();
    printSummary(publisher);
    promptPublishConfirmation(publisher, options);
  } catch (e) {
    logger.error(e);
    process.exit(1);
  }
};
