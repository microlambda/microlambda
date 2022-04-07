import { LogFilesHandler, resolveProjectRoot, Workspace } from "@centipod/core";
import { join } from 'path';

export class LogsFileHandler extends LogFilesHandler {

  readonly projectRoot: string;

  constructor(readonly workspace: Workspace) {
    super(workspace);
    this.projectRoot = resolveProjectRoot();
  }

  path(target: string): string {
    return join(this.projectRoot, '.mila', this.workspace.name, `${target}.logs`);
  }
}
