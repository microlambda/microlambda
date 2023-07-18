import { AbstractLogsHandler, Workspace } from '@microlambda/runner-core';
import { IOSocketManager } from '@microlambda/server';

export class WebsocketLogsHandler extends AbstractLogsHandler<unknown> {
  name = 'websocket';

  constructor(readonly workspace: Workspace, private readonly _io: IOSocketManager) {
    super(workspace);
  }

  append(target: string, chunk: string | Buffer): void {
    switch (target) {
      case 'build':
        this._io.handleTscLogs(this.workspace.name, chunk.toString());
        break;
      case 'start':
        this._io.handleServiceLog(this.workspace.name, chunk.toString());
        break;
    }
  }

  close(target: string): void {
    /* no overloaded */
  }
  open(target: string): void {
    /* no overloaded */
  }
}
