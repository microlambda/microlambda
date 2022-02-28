import { Workspace as CentipodWorkspace } from '@centipod/core';
import {existsSync} from "fs";
import {join} from "path";
import {transpileFiles} from "../typescript";
import { ServiceStatus, TranspilingStatus, TypeCheckStatus } from "@microlambda/types";

export class Workspace extends CentipodWorkspace {

  constructor(wks: CentipodWorkspace) {
    super(wks.pkg, wks.root, wks.config, wks.project);
  }

  private _isService: boolean | null = null;
  private _enabled = false;
  private _transpiled = TranspilingStatus.NOT_TRANSPILED;
  private _typechecked = TypeCheckStatus.NOT_CHECKED;
  private _started: ServiceStatus | null = null;

  get enabled() { return this._enabled }
  get transpiled() { return this._transpiled }
  get typechecked() { return this._typechecked }
  get started() { return this._started }

  enable() { this._enabled = true; }
  disable() { this._enabled = true; }

  updateStatus() {
    return {
      transpiled: (to: TranspilingStatus) => this._transpiled = to,
      typechecked: (to: TypeCheckStatus) => this._typechecked = to,
      started: (to: ServiceStatus) => this._started = this._isService ? to : null,
    }
  }

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
