import { Project, Workspace } from '@microlambda/runner-core';
import { MilaError, MilaErrorCode } from '@microlambda/errors';
import { join } from 'path';
import { fs } from '@microlambda/utils';
import dotenv from 'dotenv';
import { IBaseLogger } from '@microlambda/types';
import { promises } from 'fs';

export class DotenvManager {

  private _parsed: Record<string, string> | undefined;
  private _exists = false;

  constructor(
    readonly project: Project,
    readonly scope?: { env?: string, service?: Workspace | string },
    private readonly _logger?: IBaseLogger,
  ) {}

  get workspace(): Workspace | undefined {
    if (this.scope?.service) {
      const workspace = typeof this.scope?.service === 'string'
        ? this.project.workspaces.get(this.scope?.service)
        : this.scope?.service;
      if (!workspace) {
        throw new MilaError(MilaErrorCode.UNABLE_TO_LOAD_WORKSPACE, `Workspace not found: ${this.scope?.service}`);
      }
      return workspace;
    }
    return undefined;
  }

  get path(): string {
    return join(this.workspace?.root ?? this.project.root, this.scope?.env ? `.env.${this.scope.env}` : '.env');
  }

  async load(force = false): Promise<Record<string, string>> {
    if (this._parsed && !force) {
      return this._parsed;
    }
    if (await fs.exists(this.path)) {
      this._exists = true;
      this._parsed = dotenv.parse((await promises.readFile(this.path)).toString());
    } else {
      this._logger?.info('Dotenv file not found, skipping', this.path);
      this._exists = false;
      this._parsed = {};
    }
    return this._parsed;
  }

  async hasKey(key: string): Promise<boolean> {
    return (await this.getKey(key))!= null;
  }

  async getKey(key: string): Promise<string | undefined> {
    if (!this._parsed) {
      await this.load();
    }
    return this._parsed![key];
  }

  async addKey(key: string, value: string): Promise<void> {
    if (!this._parsed) {
      await this.load();
    }
    this._parsed![key] = value;
    await this._dump();
  }

  async removeKey(key: string): Promise<void> {
    if (!this._parsed) {
      await this.load();
    }
    delete this._parsed![key];
    await this._dump();
  }

  async _dump(): Promise<void> {
    if (this._parsed) {
      await promises.writeFile(
        this.path,
        Object.entries(this._parsed).map(([key, value]) => `${key}=${value}`).join('\n'),
      );
    }
  }
}
