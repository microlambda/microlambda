import { Workspace as CentipodWorkspace } from '@centipod/core';
import {existsSync} from "fs";
import {join} from "path";
import {transpileFiles} from "../typescript";

export class Workspace extends CentipodWorkspace {

  constructor(wks: CentipodWorkspace) {
    super(wks.pkg, wks.root, wks.config, wks.project);
  }

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

  async transpile(): Promise<void> {
    await transpileFiles(this.root);
  }
}
