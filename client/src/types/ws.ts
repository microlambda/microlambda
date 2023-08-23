import type {LogsSlice} from "./logs-slice";
import type {ServiceStatus, ICommandMetric, TranspilingStatus, TypeCheckStatus} from "@microlambda/types";

export interface ILogsReceivedEvent {
  type: 'events' | 'build' | 'offline';
  lines: string[];
  slice: LogsSlice;
}

export interface IStartCommandEvent {
  type: 'start';
  workspace: string;
  status: ServiceStatus;
  metrics: ICommandMetric;
}

export interface IBuildCommandEvent {
  type: 'build';
  workspace: string;
  status: TypeCheckStatus;
  metrics: ICommandMetric;
}

export interface ITranspileCommandEvent {
  type: 'transpile';
  workspace: string;
  status: TranspilingStatus;
  metrics: ICommandMetric;
}

export type IRunCommandEvent = IStartCommandEvent | IBuildCommandEvent | ITranspileCommandEvent;
