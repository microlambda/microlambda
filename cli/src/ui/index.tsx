import React from 'react';
import { Provider } from 'react-redux';
import { Instance, render } from 'ink';
import { App } from './components/main';
import { store } from './state/store';
import { LernaGraph, LernaNode, Service } from '../lerna';
import { setGraph as sg, updateCompilationStatus as ucs, updateServiceStatus as uss } from './state/actions';

export const doRender = (): Instance =>
  render(
    <Provider store={store}>
      <App />
    </Provider>,
  );

export const setGraph = (graph: LernaGraph): void => {
  store.dispatch(sg(graph));
};

export const updateCompilationStatus = (node: LernaNode): void => {
  store.dispatch(ucs(node));
};

export const updateServiceStatus = (service: Service): void => {
  store.dispatch(uss(service));
};
