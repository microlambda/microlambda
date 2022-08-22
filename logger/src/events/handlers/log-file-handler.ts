import { join } from 'path';
import { createWriteStream, existsSync, mkdirSync, WriteStream } from "fs";
import { IEventsLogEntry } from '../events-log-entry';
import { IEventsLogHandler } from './events-log-handler';
import { resolveProjectRoot } from '@microlambda/utils';

/*export class LogsFileHandler extends LogFilesHandler {

  readonly projectRoot: string;
  readonly logsRoot: string;

  constructor(readonly workspace: Workspace) {
    super(workspace);
    this.projectRoot = resolveProjectRoot();
    this.logsRoot = join(this.projectRoot, '.mila', 'logs');
    this._createLogsDirectory();
  }

  private _createLogsDirectory() {
    if (!existsSync(this.logsRoot)) {
      mkdirSync(this.logsRoot, { recursive: true });
    }
  }

  path(target: string): string {
    return join(this.logsRoot, `${this.workspace.name.replace('/', '-')}.${target}.logs`);
  }
}*/

export class EventLogsFileHandler implements IEventsLogHandler {
  private _stream: WriteStream;

  constructor(logFile: string) {
    const folder = join(resolveProjectRoot(), '.mila', 'events-logs');
    if (!existsSync(folder)) {
      mkdirSync(folder, { recursive: true });
    }
    this._stream = createWriteStream(join(folder, logFile));
  }

  write(entry: IEventsLogEntry): void {
    this._stream.write(`\n[${entry.level}] (${entry.scope || 'unscoped'}) (${entry.date}) ${entry.args.join(' ')}`);
  };
}
