import { LernaGraph, LernaNode, Service } from '../../../lerna';
import { Action } from 'redux';

export const SET_GRAPH = 'SET_GRAPH';
export const UPDATE_PACKAGE_STATUS = 'UPDATE_PACKAGE_STATUS';
export const UPDATE_SERVICE_STATUS = 'UPDATE_SERVICE_STATUS';

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
}
