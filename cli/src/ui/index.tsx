import React from 'react';
import { Provider } from 'react-redux';
import { Instance, render } from 'ink';
import { App } from './components/main';
import { store } from './state/store';
import { LernaGraph, LernaNode, Service } from '../lerna';
import {
  setGraph,
  setScheduler,
  updateCompilationStatus,
  updateServiceStatus,
  IGraphAction,
} from './state/actions/graph-updated';
import { graphBootstrapped, graphParsed, lernaErrored, parsingGraph, updateLernaVersion } from './state/actions/lerna';
import { RecompilationScheduler } from '../utils/scheduler';

export const doRender = (): Instance =>
  render(
    <Provider store={store}>
      <App />
    </Provider>,
  );

export const actions = {
  setScheduler: (scheduler: RecompilationScheduler): IGraphAction => store.dispatch(setScheduler(scheduler)),
  setGraph: (graph: LernaGraph): IGraphAction => store.dispatch(setGraph(graph)),
  updateCompilationStatus: (node: LernaNode): IGraphAction => store.dispatch(updateCompilationStatus(node)),
  updateServiceStatus: (service: Service): IGraphAction => store.dispatch(updateServiceStatus(service)),
  parsingGraph: (): IGraphAction => store.dispatch(parsingGraph()),
  graphParsed: (): IGraphAction => store.dispatch(graphParsed()),
  graphBootstrapped: (): IGraphAction => store.dispatch(graphBootstrapped()),
  lernaErrored: (): IGraphAction => store.dispatch(lernaErrored()),
  updateLernaVersion: (version: string): IGraphAction => store.dispatch(updateLernaVersion(version)),
};
