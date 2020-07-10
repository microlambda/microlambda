import { Action } from 'redux';

export const BUILD_GRAPH = 'BUILD_GRAPH';
export const GRAPH_PARSED = 'GRAPH_PARSED';
export const GRAPH_BOOTSTRAPPED = 'BOOTSTRAPPED';
export const LERNA_ERRORED = 'LERNA_ERRORED';
export const UPDATE_LERNA_VERSION = 'UPDATE_LERNA_VERSION';

export const parsingGraph = (): Action => {
  return { type: BUILD_GRAPH };
};

export const graphParsed = (): Action => {
  return { type: GRAPH_PARSED };
};

export const graphBootstrapped = (): Action => {
  return { type: GRAPH_BOOTSTRAPPED };
};

export const lernaErrored = (): Action => {
  return { type: LERNA_ERRORED };
};

export const updateLernaVersion = (version: string): Action & { version: string } => {
  return { type: UPDATE_LERNA_VERSION, version };
};
