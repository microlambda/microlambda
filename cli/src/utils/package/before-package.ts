import { EventsLog } from '@microlambda/logger';
import { getDefaultThreads, getThreads } from '@microlambda/utils';
import { beforeBuild } from '../build/pre-requisites';
import { logger } from '../logger';
import { typeCheck } from '../build/type-check';
import { IPackageOptions } from './options';
import { IPackageCmd } from './cmd-options';

export const beforePackage = async (
  projectRoot: string,
  cmd: IPackageCmd,
  eventsLog: EventsLog,
): Promise<IPackageOptions> => {
  const concurrency = cmd.c ? getThreads(Number(cmd.c)) : getDefaultThreads();
  const options = await beforeBuild(projectRoot, cmd, eventsLog, false);
  if (cmd.recompile) {
    try {
      logger.info('\nBuilding dependency graph\n');
      await typeCheck(options);
    } catch (e) {
      process.exit(1);
    }
  }
  return { ...options, verbose: cmd.v, concurrency, targets: options.service ? [options.service] : Array.from(options.project.services.values()) };
};
