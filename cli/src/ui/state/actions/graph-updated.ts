import { LernaGraph, LernaNode, Service } from '../../../lerna';
import { Action } from 'redux';
import { RecompilationScheduler } from '../../../utils/scheduler';

export const SET_GRAPH = 'SET_GRAPH';
export const UPDATE_PACKAGE_STATUS = 'UPDATE_PACKAGE_STATUS';
export const UPDATE_SERVICE_STATUS = 'UPDATE_SERVICE_STATUS';
export const SET_SCHEDULER = 'SET_SCHEDULER';

export const setScheduler = (scheduler: RecompilationScheduler): IGraphAction => {
  return { type: SET_SCHEDULER, scheduler };
};

export const setGraph = (graph: LernaGraph): IGraphAction => {
  return { type: SET_GRAPH, graph };
};

export const updateCompilationStatus = (node: LernaNode): IGraphAction => {
  return { type: UPDATE_PACKAGE_STATUS, node };
};

export const updateServiceStatus = (service: Service): IGraphAction => {
  return { type: UPDATE_SERVICE_STATUS, service };
};

export interface IGraphAction extends Action {
  graph?: LernaGraph;
  node?: LernaNode;
  service?: Service;
  scheduler?: RecompilationScheduler;
}
