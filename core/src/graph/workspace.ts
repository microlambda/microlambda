import { InMemoryLogHandler, Workspace as RunnerWorkspace } from '@microlambda/runner-core';
import { existsSync } from 'fs';
import { join } from 'path';
import { transpileFiles } from '@microlambda/utils';
import { ICommandMetrics, ICommandMetric, ServiceStatus, TranspilingStatus, TypeCheckStatus } from '@microlambda/types';
import { IServicePortsConfig } from '../resolve-ports';
import { LogsFileHandler } from '../log-handlers/file';

export class Workspace extends RunnerWorkspace {
  constructor(wks: RunnerWorkspace, ports?: IServicePortsConfig) {
    super(wks.pkg, wks.root, wks._config, wks.project);
    this._ports = ports;
    this._attachDefaultHandlers();
  }

  private _ports: IServicePortsConfig | undefined;
  private _isService: boolean | null = null;
  private _isSlsService: boolean | null = null;
  private _transpiled = TranspilingStatus.NOT_TRANSPILED;
  private _typechecked = TypeCheckStatus.NOT_CHECKED;
  private _started: ServiceStatus | null = null;
  private _metrics: ICommandMetrics = {};

  get transpiled(): TranspilingStatus {
    return this._transpiled;
  }
  get typechecked(): TypeCheckStatus {
    return this._typechecked;
  }
  get started(): ServiceStatus | null {
    return this._started;
  }
  get ports(): IServicePortsConfig | undefined {
    return this._ports;
  }
  get metrics(): ICommandMetrics {
    return this._metrics;
  }

  assignPorts(ports: IServicePortsConfig): void {
    this._ports = ports;
  }

  updateStatus(): {
    transpiled: (to: TranspilingStatus) => void;
    typechecked: (to: TypeCheckStatus) => void;
    started: (to: ServiceStatus) => void;
  } {
    return {
      transpiled: (to: TranspilingStatus) => (this._transpiled = to),
      typechecked: (to: TypeCheckStatus) => (this._typechecked = to),
      started: (to: ServiceStatus) => (this._started = this._isService ? to : null),
    };
  }

  updateMetric(): {
    transpile: (to: ICommandMetric) => void;
    typecheck: (to: ICommandMetric) => void;
    start: (to: ICommandMetric) => void;
  } {
    return {
      transpile: (metric: ICommandMetric) => (this._metrics.transpile = metric),
      typecheck: (metric: ICommandMetric) => (this._metrics.typecheck = metric),
      start: (metric: ICommandMetric) => (this._metrics.start = metric),
    };
  }

  get isService(): boolean {
    if (this._isService == null) {
      this._isService = this._checkIfService();
    }
    return this._isService;
  }

  private _checkIfService(): boolean {
    return this.config.hasOwnProperty('start');
  }

  get isSlsService(): boolean {
    if (this._isSlsService == null) {
      this._isSlsService =
        existsSync(join(this.root, 'serverless.yml')) || existsSync(join(this.root, 'serverless.yaml'));
    }
    return this._isSlsService;
  }

  async transpile(): Promise<void> {
    await transpileFiles(this.root);
  }

  private _attachDefaultHandlers(): void {
    const inMemory = new InMemoryLogHandler(this);
    const files = new LogsFileHandler(this);
    this.addLogsHandler(inMemory);
    this.addLogsHandler(files);
  }
}
