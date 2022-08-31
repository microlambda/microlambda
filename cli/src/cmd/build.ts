import { EventsLog, EventLogsFileHandler } from "@microlambda/logger";
import { resolveProjectRoot } from '@microlambda/utils';
import { logger } from '../utils/logger';
import { IBuildCmd } from '../utils/build/cmd-options';
import { printCommand } from '../utils/build/print-cmd';
import { beforeBuild } from '../utils/build/pre-requisites';
import { typeCheck } from '../utils/build/type-check';

export const build = async (cmd: IBuildCmd): Promise<void> => {
  printCommand('🔧 Building', cmd.s, cmd.only);
  const projectRoot = resolveProjectRoot();
  const eventsLog = new EventsLog(undefined, [new EventLogsFileHandler(projectRoot, `mila-build-${Date.now()}`)]);
  const options = await beforeBuild(projectRoot, cmd, eventsLog, true);
  try {
    await typeCheck(options);
    logger.info('\nSuccessfully built ✨');
    process.exit(0);
  } catch (e) {
    process.exit(1);
  }
};
