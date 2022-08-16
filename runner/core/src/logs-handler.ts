import { Workspace } from "./workspace";
import { createWriteStream, WriteStream } from "fs";
import { ExecaError, ExecaReturnValue } from "execa";

export interface ILogsHandler {
    open(target: string): void;
    commandStarted(target: string, cmd: string): void;
    append(target: string, chunk: string | Buffer): void;
    commandEnded(target: string, result: ExecaReturnValue | ExecaError ): void;
    close(target: string): void;
}

export abstract class AbstractLogsHandler<T> implements ILogsHandler {
  protected _logs: Map<string, T> = new Map();
  abstract name: string;

  constructor(protected readonly _workspace: Workspace) {}
  abstract append(target: string, chunk: string | Buffer): void;
  abstract close(target: string): void;
  abstract open(target: string): void;

  commandStarted(target: string, cmd: string): void {
    this.append(target,`Process ${cmd} started at ${new Date().toISOString()}`)
  }

  commandEnded(target: string, result: ExecaReturnValue | ExecaError): void {
    this.append(target,`Process exited with status ${result.exitCode} at ${new Date().toISOString()}`);
  }

  get(target: string): T | undefined { return this._logs.get(target) }

  protected _open(target: string, initialValue: T): void {
    if (!this._logs.has(target)) {
      this._logs.set(target, initialValue);
    }
  }
}

export class InMemoryLogHandler extends AbstractLogsHandler<Array<string>> {
  name = 'in-memory';
  open(target: string): void { this._open(target, []) }
  close(): void { /* no need to close in memory */ }

  append(target: string, chunk: string | Buffer): void {
    this.open(target);
    if (chunk) {
      this.get(target)?.push(chunk.toString());
    }
  }

  getAll(target: string): string {
    return this.get(target)?.join('\n') || '';
  }
}

export abstract class LogFilesHandler extends AbstractLogsHandler<WriteStream> {
  name = 'log-files';
  abstract path(target: string): string;

  open(target: string): void {
    this._open(target, createWriteStream(this.path(target)));
  }

  append(target: string, chunk: string | Buffer): void {
    this.open(target);
    try {
      if (chunk) {
        this.get(target)?.write(chunk);
      }
    } catch (e) {
      /* best effort, should not crash the process */
    }
  }

  close(target: string): void {
    const TEN_SECONDS = 10 * 1000;
    setTimeout(() => {
      this.get(target)?.close();
      this._logs.delete(target);
    }, TEN_SECONDS);
  }
}
