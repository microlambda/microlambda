import { TranspilingStatus, TypeCheckStatus } from './compilation.status.enum';
import { INode } from './node.interface';

export class Package {
  private readonly _name: string;
  private readonly _version: string;
  private readonly _enabled: boolean;
  private _transpiled: TranspilingStatus;
  private _typeChecked: TypeCheckStatus;
  private _lastTypeCheck: string;

  constructor(node: INode) {
    this._name = node.name;
    this._version = node.version;
    this._enabled = node.enabled;
    this._transpiled = node.transpiled;
    this._typeChecked = node.typeChecked;
    this._lastTypeCheck = node.lastTypeCheck;
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

  get lastTypeCheck(): string {
    return this._lastTypeCheck;
  }

  get transpiled(): string {
    switch (this._transpiled) {
      case TranspilingStatus.TRANSPILED:
        return 'Transpiled';
      case TranspilingStatus.TRANSPILING:
        return 'Transpiling';
      case TranspilingStatus.ERROR_TRANSPILING:
        return 'Error transpiling';
      case TranspilingStatus.NOT_TRANSPILED:
        return 'Not transpiled';
    }
  }

  get typeChecked(): string {
    switch (this._typeChecked) {
      case TypeCheckStatus.CHECKING:
        return 'Typechecking';
      case TypeCheckStatus.NOT_CHECKED:
        return 'Only transpiled';
      case TypeCheckStatus.ERROR:
        return 'Type errors';
      case TypeCheckStatus.SUCCESS:
        return 'Type checked';
    }
  }

  get transpiledClass(): string {
    switch (this._transpiled) {
      case TranspilingStatus.TRANSPILED:
        return 'green';
      case TranspilingStatus.TRANSPILING:
        return 'blue';
      case TranspilingStatus.ERROR_TRANSPILING:
        return 'bright-red';
      case TranspilingStatus.NOT_TRANSPILED:
        return 'grey';
    }
  }

  get typeCheckClass(): string {
    switch (this._typeChecked) {
      case TypeCheckStatus.CHECKING:
        return 'blue';
      case TypeCheckStatus.NOT_CHECKED:
        return 'grey';
      case TypeCheckStatus.ERROR:
        return 'bright-red';
      case TypeCheckStatus.SUCCESS:
        return 'green';
    }
  }

  get notChecked(): boolean {
    return this._typeChecked === TypeCheckStatus.NOT_CHECKED;
  }

  get checking(): boolean {
    return this._typeChecked === TypeCheckStatus.CHECKING;
  }

  setTranspilingStatus(status: TranspilingStatus): void {
    this._transpiled = status;
  }

  setTypeCheckStatus(status: TypeCheckStatus): void {
    this._typeChecked = status;
  }
}
