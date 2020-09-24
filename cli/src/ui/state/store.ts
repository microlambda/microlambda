import { TranspilingStatus } from '../../lerna/enums/compilation.status';
import { ServiceStatus } from '../../lerna/enums/service.status';
import { createStore } from 'redux';
import rootReducer from './reducers';
import { RecompilationScheduler } from '../../utils/scheduler';

export enum BootstrapStatus {
  READY,
  BUILDING_GRAPH,
  BOOTSTRAPPING,
  SUCCEED,
  ERRORED,
}

// TODO: Display used ts + sls versions in side panel
export interface IBinariesVersion {
  typescript: string;
  serverless: string;
}

export interface IPackage {
  enabled: boolean;
  name: string;
  version: string;
  compilationStatus: TranspilingStatus;
  binaries?: IBinariesVersion;
}

export interface IService extends IPackage {
  status: ServiceStatus;
  port: number;
}

export interface ILernaState {
  lerna: {
    version: string;
    status: BootstrapStatus;
  };
}

export interface IGraphState {
  scheduler: RecompilationScheduler;
  services: IService[];
  nodeSelected: string;
  packages: IPackage[];
}

export type IState = ILernaState & IGraphState;

export const store = createStore(rootReducer);
