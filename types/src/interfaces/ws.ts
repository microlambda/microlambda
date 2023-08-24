import {ServiceStatus} from "../enums/service.status.enum";
import {ICommandMetric} from "./node-summary";
import {TranspilingStatus, TypeCheckStatus} from "../enums/compilation.status.enum";

export interface ILogsReceivedEvent {
  target: string;
  workspace: string;
  log: string;
}

export interface IStartCommandEvent {
  type: 'start';
  workspace: string;
  status: ServiceStatus;
  metrics?: ICommandMetric;
}

export interface IBuildCommandEvent {
  type: 'build';
  workspace: string;
  status: TypeCheckStatus;
  metrics?: ICommandMetric;
}

export interface ITranspileCommandEvent {
  type: 'transpile';
  workspace: string;
  status: TranspilingStatus;
  metrics?: ICommandMetric;
}

export type IRunCommandEvent = IStartCommandEvent | IBuildCommandEvent | ITranspileCommandEvent;
