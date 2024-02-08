import { EventsLog, EventLogsFileHandler } from '@microlambda/logger';
import { logger } from '../utils/logger';
import { runBlueprint } from '@microlambda/generators';
import { resolveProjectRoot } from '@microlambda/utils';

export const generate = async (blueprint: string): Promise<void> => {
  logger.lf();
  logger.info('🧙 Microlambda code generator');
  logger.lf();
  const projectRoot = resolveProjectRoot();
  const eventsLog = new EventsLog(undefined, [new EventLogsFileHandler(projectRoot, `mila-generate-${Date.now()}`)]);
  const eventsLogger = eventsLog.scope('generator');
  await runBlueprint({
    projectRoot,
    blueprint,
    loggers: {
      events: eventsLogger,
      console: logger,
    },
  });
};
