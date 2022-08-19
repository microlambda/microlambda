import { LogFilesHandler, Workspace } from "@microlambda/runner-core";
import { join } from 'path';
import { createWriteStream, existsSync, mkdirSync, WriteStream } from "fs";
import { IEventsLogEntry, IEventsLogHandler } from "@microlambda/logger";
import { resolveProjectRoot } from '@microlambda/utils';

export class LogsFileHandler extends LogFilesHandler {

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
}

export class EventLogsFileHandler implements IEventsLogHandler {
  private _stream: WriteStream;

  constructor() {
    const folder = join(resolveProjectRoot(), '.mila');
    if (!existsSync(folder)) {
      mkdirSync(folder, { recursive: true });
    }
    this._stream = createWriteStream(join(folder, 'events.log'));
  }

  write(entry: IEventsLogEntry): void {
    this._stream.write(`\n[${entry.level}] (${entry.date}) ${entry.args.join(' ')}`);
  };
}
