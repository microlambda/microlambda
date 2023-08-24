import { AbstractLogsHandler, Workspace } from '@microlambda/runner-core';
import { IOSocketManager } from '@microlambda/server';

export class WebsocketLogsHandler extends AbstractLogsHandler<unknown> {
  name = 'websocket';

  constructor(readonly workspace: Workspace, private readonly _io: IOSocketManager) {
    super(workspace);
  }

  append(target: string, chunk: string | Buffer): void {
    this._io.handleTargetLog(target, chunk.toString(), this.workspace.name);
  }
  close(): void {
    /* not overloaded */
  }
  open(): void {
    /* not overloaded */
  }
}
