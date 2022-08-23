import { join } from 'path';
import { createWriteStream, existsSync, mkdirSync, WriteStream } from "fs";
import { IEventsLogEntry } from '../events-log-entry';
import { IEventsLogHandler } from './events-log-handler';

export class EventLogsFileHandler implements IEventsLogHandler {
  private _stream: WriteStream;

  constructor(projectRoot: string, logFile: string) {
    const folder = join(projectRoot, '.mila', 'events-logs');
    if (!existsSync(folder)) {
      mkdirSync(folder, { recursive: true });
    }
    this._stream = createWriteStream(join(folder, logFile));
  }

  write(entry: IEventsLogEntry): void {
    this._stream.write(`\n[${entry.level}] (${entry.scope || 'unscoped'}) (${entry.date}) ${entry.args.join(' ')}`);
  };
}
