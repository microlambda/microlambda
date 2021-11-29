import { Workspace as CentipodWorkspace } from '@centipod/core';
import {existsSync} from "fs";
import {join} from "path";

export class Workspace extends CentipodWorkspace {

  private _isService: boolean | null = null;

  get isService(): boolean {
    if (this._isService == null) {
      this._isService = this._checkIfService();
    }
    return this._isService;
  }

  private _checkIfService(): boolean {
    return existsSync(join(this.root, 'serverless.yml')) || existsSync(join(this.root, 'serverless.yaml'));
  }
}
