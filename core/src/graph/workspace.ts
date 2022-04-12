import { InMemoryLogHandler, Workspace as CentipodWorkspace } from "@centipod/core";
import {existsSync} from "fs";
import {join} from "path";
import {transpileFiles} from "../typescript";
import { ICommandMetrics, ICommandMetric, ServiceStatus, TranspilingStatus, TypeCheckStatus } from "@microlambda/types";
import { IServicePortsConfig } from "../resolve-ports";
import { LogsFileHandler } from "../log-handlers/file";

export class Workspace extends CentipodWorkspace {

  constructor(wks: CentipodWorkspace, ports?: IServicePortsConfig) {
    super(wks.pkg, wks.root, wks.config, wks.project);
    this._ports = ports;
    this._attachDefaultHandlers();
  }

  private _ports: IServicePortsConfig | undefined;
  private _isService: boolean | null = null;
  private _enabled = false;
  private _transpiled = TranspilingStatus.NOT_TRANSPILED;
  private _typechecked = TypeCheckStatus.NOT_CHECKED;
  private _started: ServiceStatus | null = null;
  private _metrics: ICommandMetrics = {};

  get enabled() { return this._enabled }
  get transpiled() { return this._transpiled }
  get typechecked() { return this._typechecked }
  get started() { return this._started }
  get ports() { return this._ports }
  get metrics() { return this._metrics }

  assignPorts(ports: IServicePortsConfig) { this._ports = ports }

  enable() { this._enabled = true; }
  disable() { this._enabled = true; }

  updateStatus() {
    return {
      transpiled: (to: TranspilingStatus) => this._transpiled = to,
      typechecked: (to: TypeCheckStatus) => this._typechecked = to,
      started: (to: ServiceStatus) => this._started = this._isService ? to : null,
    }
  }

  updateMetric() {
    return {
      transpile: (metric: ICommandMetric) => this._metrics.transpile = metric,
      typecheck: (metric: ICommandMetric) => this._metrics.typecheck = metric,
      start: (metric: ICommandMetric) => this._metrics.start = metric,
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

  private _attachDefaultHandlers(): void {
    const inMemory = new InMemoryLogHandler(this);
    const files = new LogsFileHandler(this);
    console.debug('Attaching logs handlers', this.name);
    this.addLogsHandler(inMemory);
    this.addLogsHandler(files);
  }
}
