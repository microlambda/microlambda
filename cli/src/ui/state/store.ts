import { CompilationStatus } from '../../lerna/enums/compilation.status';
import { ServiceStatus } from '../../lerna/enums/service.status';
import { createStore } from 'redux';
import rootReducer from './reducers';

export interface IPackage {
  enabled: boolean;
  name: string;
  compilationStatus: CompilationStatus;
}

export interface IService extends IPackage {
  status: ServiceStatus;
  port: number;
}

export type PackageAction =
  | 'start'
  | 'stop'
  | 'restart'
  | 'enable'
  | 'disable'
  | 'logs'
  | 'test'
  | 'package'
  | 'deploy';

export interface IState {
  services: IService[];
  packages: IPackage[];
  nodeSelected: string;
  actionPanelOpen: boolean;
  actionSelected: PackageAction;
}

export const defaultState: IState = {
  services: [],
  packages: [],
  nodeSelected: null,
  actionSelected: null,
  actionPanelOpen: false,
};

export const store = createStore(rootReducer);
