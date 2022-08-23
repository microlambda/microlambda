import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { LogFilesHandler, Workspace } from '@microlambda/runner-core';
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
