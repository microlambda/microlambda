import { ExecaChildProcess, ExecaReturnValue } from "execa";
import { Workspace } from "./workspace";
import { IChangeEvent } from "./watcher";

export interface IProcessResult {
  commands: Array<CommandResult>;
  overall: number;
  fromCache: boolean;
  remoteCache?: boolean;
}

export const isDaemon = (processResult: CommandResult): processResult is IDaemonCommandResult => {
  return processResult.daemon;
}

export const isNotDaemon = (processResult: CommandResult): processResult is ICommandResult => {
  return !processResult.daemon;
}

export type CommandResult = IDaemonCommandResult | ICommandResult;


export interface IDaemonCommandResult {
  daemon: true;
  process: ExecaChildProcess;
  took: number;
}

export interface ICommandResult extends ExecaReturnValue {
  daemon: false;
  took: number;
}

export enum RunCommandEventEnum {
  TARGETS_RESOLVED,
  NODE_PROCESSED,
  NODE_ERRORED,
  NODE_STARTED,
  NODE_SKIPPED,
  CACHE_INVALIDATED,
  ERROR_INVALIDATING_CACHE,
  SOURCES_CHANGED,
  NODE_INTERRUPTED,
  ARTIFACTS_DOWNLOADED,
  ARTIFACTS_UPLOADED,
}

export interface IResolvedTarget {
  workspace: Workspace;
  // TODO: Remove affected as it is no longer used
  affected: boolean;
  hasCommand: boolean;
}

export type Step = IResolvedTarget[];

export interface ITargetsResolvedEvent {
  type: RunCommandEventEnum.TARGETS_RESOLVED;
  targets: IResolvedTarget[];
}

export interface ISourceChangedEvent {
  type: RunCommandEventEnum.SOURCES_CHANGED;
  target: IResolvedTarget;
  events: Array<IChangeEvent>;
}

export interface INodeInterruptedEvent {
  type: RunCommandEventEnum.NODE_INTERRUPTED;
  target: IResolvedTarget;
}

export interface INodeSkippedEvent {
  type: RunCommandEventEnum.NODE_SKIPPED;
  target: IResolvedTarget;

}

export interface IRunCommandStartedEvent {
  type: RunCommandEventEnum.NODE_STARTED;
  target: IResolvedTarget;
}

export interface IRunCommandSuccessEvent {
  type: RunCommandEventEnum.NODE_PROCESSED;
  result: IProcessResult;
  target: IResolvedTarget;
}

export interface ICacheInvalidatedEvent {
  type: RunCommandEventEnum.CACHE_INVALIDATED;
  target: IResolvedTarget;
}

export interface IErrorInvalidatingCacheEvent {
  type: RunCommandEventEnum.ERROR_INVALIDATING_CACHE;
  error: unknown;
  target: IResolvedTarget;
}

export interface IRunCommandErrorEvent {
  type: RunCommandEventEnum.NODE_ERRORED;
  error: unknown;
  target: IResolvedTarget;
}

export type RunCommandEvent = IRunCommandStartedEvent | ITargetsResolvedEvent | IRunCommandSuccessEvent | IRunCommandErrorEvent | INodeSkippedEvent | ICacheInvalidatedEvent | IErrorInvalidatingCacheEvent | INodeInterruptedEvent | ISourceChangedEvent;

export const isTargetResolvedEvent = (event: RunCommandEvent): event is  ITargetsResolvedEvent => event.type === RunCommandEventEnum.TARGETS_RESOLVED;
export const isNodeSucceededEvent = (event: RunCommandEvent): event is  IRunCommandSuccessEvent => event.type === RunCommandEventEnum.NODE_PROCESSED;
export const isNodeErroredEvent = (event: RunCommandEvent): event is  IRunCommandErrorEvent => event.type === RunCommandEventEnum.NODE_ERRORED;
export const isNodeStartedEvent = (event: RunCommandEvent): event is  IRunCommandStartedEvent => event.type === RunCommandEventEnum.NODE_STARTED;
export const isNodeSkippedEvent = (event: RunCommandEvent): event is  IRunCommandStartedEvent => event.type === RunCommandEventEnum.NODE_SKIPPED;
export const isSourceChangedEvent = (event: RunCommandEvent): event is  ISourceChangedEvent => event.type === RunCommandEventEnum.SOURCES_CHANGED;
