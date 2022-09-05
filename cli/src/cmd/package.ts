import { EventsLog } from "@microlambda/logger";
import { resolveProjectRoot } from '@microlambda/utils';
import { EventLogsFileHandler } from '@microlambda/logger/lib';
import { logger } from '../utils/logger';
import { printCommand } from '../utils/build/print-cmd';
import { beforePackage } from '../utils/package/before-package';
import { IPackageCmd } from '../utils/package/cmd-options';
import { packageServices } from '../utils/package/do-package';
import { printReport } from '../utils/deploy/print-report';

export const packagr = async (cmd: IPackageCmd): Promise<void> => {
  try {
    printCommand('📦 Packaging', cmd.s, true);
    const projectRoot = resolveProjectRoot();
    const eventsLog = new EventsLog(undefined, [new EventLogsFileHandler(projectRoot, `mila-package-${Date.now()}`)]);
    const options = await beforePackage(projectRoot, cmd, eventsLog);
    const { failures, success } = await packageServices(options);
    if (failures.size) {
      await printReport(success, failures, options.workspaces.length, 'package', options.verbose);
      process.exit(1);
    }
    process.exit(0);
  } catch (e) {
    logger.error(e);
    process.exit(1);
  }
};
