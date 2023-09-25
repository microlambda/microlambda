import { ExecaReturnValue } from 'execa';

export enum SharedInfraDeployEventType {
  STACKS_RESOLVED = 'stack_resolved',
  DEPLOYING = 'deploying',
  NO_CHANGES = 'no_changes',
  REMOVING = 'removing',
  DEPLOYED = 'deployed',
  REMOVED = 'removed',
  FAILED_DEPLOY = 'failed_deploy',
  FAILED_REMOVE = 'failed_removed',
}
interface ISharedInfraStacksResolvedEvent {
  type: SharedInfraDeployEventType.STACKS_RESOLVED;
  stacks: string[];
}

interface ISharedInfraStartDeployEvent {
  type: SharedInfraDeployEventType.DEPLOYING | SharedInfraDeployEventType.REMOVING;
  stack: string;
  env: string;
  region: string;
}

interface ISharedInfraSkipDeployEvent {
  type: SharedInfraDeployEventType.NO_CHANGES;
  stack: string;
  env: string;
  region: string;
}

interface ISharedInfraSuccessDeployEvent {
  type: SharedInfraDeployEventType.DEPLOYED | SharedInfraDeployEventType.REMOVED;
  stack: string;
  env: string;
  region: string;
  result: ExecaReturnValue<string>;
}

export interface ISharedInfraFailedDeployEvent {
  type: SharedInfraDeployEventType.FAILED_DEPLOY | SharedInfraDeployEventType.FAILED_REMOVE;
  stack: string;
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
