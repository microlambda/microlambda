import { CompilationStatus } from './compilation.status.enum';
import { INode } from './node.interface';

export class Package {
  private readonly _name: string;
  private readonly _version: string;
  private readonly _enabled: boolean;
  private _compilationStatus: CompilationStatus;
  constructor(node: INode) {
    this._name = node.name;
    this._version = node.version;
    this._enabled = node.enabled;
    this._compilationStatus = node.compiled;
  }

  get name(): string {
    return this._name;
  }

  get disabled(): boolean {
    return !this._enabled;
  }

  get version(): string {
    return this._version;
  }

  get compilationStatus(): string {
    switch (this._compilationStatus) {
      case CompilationStatus.COMPILED:
        return 'Compiled';
      case CompilationStatus.COMPILING:
        return 'Compiling';
      case CompilationStatus.ERROR_COMPILING:
        return 'Error compiling';
      case CompilationStatus.NOT_COMPILED:
        return 'Not compiled';
    }
  }

  get compilationClass(): string {
    switch (this._compilationStatus) {
      case CompilationStatus.COMPILED:
        return 'green';
      case CompilationStatus.COMPILING:
        return 'blue';
      case CompilationStatus.ERROR_COMPILING:
        return 'bright-red';
      case CompilationStatus.NOT_COMPILED:
        return 'grey';
    }
  }

  get notCompiled(): boolean {
    return this._compilationStatus === CompilationStatus.NOT_COMPILED;
  }

  get compiling(): boolean {
    return this._compilationStatus === CompilationStatus.COMPILING;
  }

  setCompilationStatus(status: CompilationStatus): void {
    this._compilationStatus = status;
  }
}
