import { graphStatus } from './reducers/graph-status';
import { userInputs } from './reducers/user-input';
import { defaultState, IState } from './store';
import { IGraphAction, SET_GRAPH, UPDATE_PACKAGE_STATUS, UPDATE_SERVICE_STATUS } from './actions/graph-updated';
import { DOWN_ARROW_PRESSED, ENTER_PRESSED, ESCAPE_PRESSED, UP_ARROW_PRESSED } from './actions/user-input';

const rootReducer = (state: IState = defaultState, action: IGraphAction): IState => {
  switch (action.type) {
    case DOWN_ARROW_PRESSED:
    case UP_ARROW_PRESSED:
    case ENTER_PRESSED:
    case ESCAPE_PRESSED:
      return userInputs(state, action);
    case SET_GRAPH:
    case UPDATE_PACKAGE_STATUS:
    case UPDATE_SERVICE_STATUS:
      return graphStatus(state, action);
    default:
      return state;
  }
};

export default rootReducer;
