import { join } from 'path';
import { createWriteStream, existsSync, mkdirSync, WriteStream } from "fs";
import { IEventsLogEntry } from '../events-log-entry';
import { IEventsLogHandler } from './events-log-handler';
import { inspect } from 'util';
import { DEFAULT_INSPECT_DEPTH } from '../defaults';

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
    this._stream.write(`\n[${entry.level}] (${entry.scope || 'unscoped'}) (${entry.date}) ${entry.args.map(EventLogsFileHandler._toString).join(' ')}`);
  };

  private static _toString(arg: unknown) {
    return typeof arg === 'string'
      ? arg
      : inspect(
        arg,
        false,
        Number.isInteger(Number(process.env.MILA_INSPECT_DEPTH)) ? Number(process.env.MILA_INSPECT_DEPTH) : DEFAULT_INSPECT_DEPTH,
        false,
      );
  }
}
