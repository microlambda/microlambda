import { AbstractLogsHandler, Workspace } from "@centipod/core";

export class WebsocketLogsHandler extends AbstractLogsHandler<unknown> {
  name = 'websocket';

  constructor(readonly workspace: Workspace, private readonly io:  ) {
    super(workspace);
  }

  append(target: string, chunk: string | Buffer): void {
  }

  close(target: string): void {
  }


  open(target: string): void {
  }

}
