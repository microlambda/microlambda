import { IGraphState } from '../store';
import {
  IGraphAction,
  SET_GRAPH,
  SET_SCHEDULER,
  UPDATE_PACKAGE_STATUS,
  UPDATE_SERVICE_STATUS,
} from '../actions/graph-updated';
import { DOWN_ARROW_PRESSED, ENTER_PRESSED, ESCAPE_PRESSED, Q_PRESSED, UP_ARROW_PRESSED } from '../actions/user-input';
import { userInputs } from './user-input';
import { graphStatus } from './graph-status';

const defaultState: IGraphState = {
  services: [],
  packages: [],
  nodeSelected: null,
  scheduler: null,
};

export const graphReducer = (state: IGraphState = defaultState, action: IGraphAction): IGraphState => {
  switch (action.type) {
    case DOWN_ARROW_PRESSED:
    case UP_ARROW_PRESSED:
    case ENTER_PRESSED:
    case ESCAPE_PRESSED:
    case Q_PRESSED:
      return userInputs(state, action);
    case SET_SCHEDULER:
    case SET_GRAPH:
    case UPDATE_PACKAGE_STATUS:
    case UPDATE_SERVICE_STATUS:
      return graphStatus(state, action);
    default:
      return state;
  }
};
