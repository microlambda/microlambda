import { combineReducers } from 'redux';
import { lernaStatusReducer } from './reducers/lerna';
import { graphReducer } from './reducers/graph';
import { IGraphState, ILernaState } from './store';

export default combineReducers({
  graphReducer,
  lernaStatusReducer,
});

export interface IReducersOutput {
  graphReducer: IGraphState;
  lernaStatusReducer: ILernaState;
}
