import React from 'react';
import { Provider } from 'react-redux';
import { Instance, render } from 'ink';
import { App } from './components/main';
import { store } from './state/store';
import { LernaGraph, LernaNode, Service } from '../lerna';
import { setGraph, updateCompilationStatus, updateServiceStatus } from './state/actions/graph-updated';
import { graphBootstrapped, graphParsed, lernaErrored, parsingGraph, updateLernaVersion } from './state/actions/lerna';

export const doRender = (): Instance =>
  render(
    <Provider store={store}>
      <App />
    </Provider>,
  );

export const actions = {
  setGraph: (graph: LernaGraph) => store.dispatch(setGraph(graph)),
  updateCompilationStatus: (node: LernaNode) => store.dispatch(updateCompilationStatus(node)),
  updateServiceStatus: (service: Service) => store.dispatch(updateServiceStatus(service)),
  parsingGraph: () => store.dispatch(parsingGraph()),
  graphParsed: () => store.dispatch(graphParsed()),
  graphBootstrapped: () => store.dispatch(graphBootstrapped()),
  lernaErrored: () => store.dispatch(lernaErrored()),
  updateLernaVersion: (version: string) => store.dispatch(updateLernaVersion(version)),
};
