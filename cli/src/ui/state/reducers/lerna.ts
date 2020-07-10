import { BUILD_GRAPH, GRAPH_BOOTSTRAPPED, GRAPH_PARSED, LERNA_ERRORED, UPDATE_LERNA_VERSION } from '../actions/lerna';
import { BootstrapStatus, ILernaState } from '../store';
import { Action } from 'redux';

const defaultState: ILernaState = {
  lerna: {
    version: null,
    status: 0,
  },
};
export const lernaStatusReducer = (
  state: ILernaState = defaultState,
  action: Action & { version?: string },
): ILernaState => {
  switch (action.type) {
    case BUILD_GRAPH:
      return {
        lerna: {
          version: state.lerna.version,
          status: BootstrapStatus.BUILDING_GRAPH,
        },
      };
    case GRAPH_PARSED:
      return {
        lerna: {
          version: state.lerna.version,
          status: BootstrapStatus.BOOTSTRAPPING,
        },
      };
    case GRAPH_BOOTSTRAPPED:
      return {
        lerna: {
          version: state.lerna.version,
          status: BootstrapStatus.SUCCEED,
        },
      };
    case LERNA_ERRORED:
      return {
        lerna: {
          version: state.lerna.version,
          status: BootstrapStatus.ERRORED,
        },
      };
    case UPDATE_LERNA_VERSION:
      return {
        lerna: {
          version: action.version,
          status: state.lerna.status,
        },
      };
    default:
      return state;
  }
};
