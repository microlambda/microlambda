import { ExecaReturnValue } from 'execa';

export enum SharedInfraDeployEventType {
  STACKS_RESOLVED = 'stack_resolved',
  STARTED = 'started',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
}
interface ISharedInfraStacksResolvedEvent {
  type: SharedInfraDeployEventType.STACKS_RESOLVED;
  stacks: string[];
}

interface ISharedInfraStartDeployEvent {
  type: SharedInfraDeployEventType.STARTED;
  stack: string;
  env: string;
  region: string;
}

interface ISharedInfraSuccessDeployEvent {
  type: SharedInfraDeployEventType.SUCCEEDED;
  stack: string;
  env: string;
  region: string;
  result: ExecaReturnValue<string>;
}

export interface ISharedInfraFailedDeployEvent {
  type: SharedInfraDeployEventType.FAILED;
  stack: string;
  env: string;
  region: string;
  err: unknown;
}

export type SharedInfraDeployEvent =
  | ISharedInfraStacksResolvedEvent
  | ISharedInfraStartDeployEvent
  | ISharedInfraSuccessDeployEvent
  | ISharedInfraFailedDeployEvent;
