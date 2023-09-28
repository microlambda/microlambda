import {Workspace} from "../graph/workspace";
import {IProcessResult} from "@microlambda/runner-core";

export enum SharedInfraDeployEventType {
  WORKSPACES_RESOLVED = 'workspaces_resolved',
  DEPLOYING = 'deploying',
  NO_CHANGES = 'no_changes',
  REMOVING = 'removing',
  DEPLOYED = 'deployed',
  REMOVED = 'removed',
  FAILED_DEPLOY = 'failed_deploy',
  FAILED_REMOVE = 'failed_removed',
}
interface ISharedInfraStacksResolvedEvent {
  type: SharedInfraDeployEventType.WORKSPACES_RESOLVED;
  workspaces: Workspace[];
}

interface ISharedInfraStartDeployEvent {
  type: SharedInfraDeployEventType.DEPLOYING | SharedInfraDeployEventType.REMOVING;
  workspace: Workspace;
  env: string;
  region: string;
}

interface ISharedInfraSkipDeployEvent {
  type: SharedInfraDeployEventType.NO_CHANGES;
  workspace: Workspace;
  env: string;
  region: string;
}

interface ISharedInfraSuccessDeployEvent {
  type: SharedInfraDeployEventType.DEPLOYED | SharedInfraDeployEventType.REMOVED;
  workspace: Workspace;
  env: string;
  region: string;
  result: IProcessResult;
}

export interface ISharedInfraFailedDeployEvent {
  type: SharedInfraDeployEventType.FAILED_DEPLOY | SharedInfraDeployEventType.FAILED_REMOVE;
  workspace: Workspace;
  env: string;
  region: string;
  err: unknown;
}

export type SharedInfraDeployEvent =
  | ISharedInfraStacksResolvedEvent
  | ISharedInfraStartDeployEvent
  | ISharedInfraSkipDeployEvent
  | ISharedInfraSuccessDeployEvent
  | ISharedInfraFailedDeployEvent;
