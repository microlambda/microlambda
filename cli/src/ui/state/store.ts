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

export interface IState {
  services: IService[];
  packages: IPackage[];
}

export const store = createStore(rootReducer);
