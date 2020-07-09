import { IService, IState } from '../store';
import { Action } from 'redux';
import { DOWN_ARROW_PRESSED, ENTER_PRESSED, ESCAPE_PRESSED, UP_ARROW_PRESSED } from '../actions/user-input';

export const userInputs = (state: IState, action: Action): IState => {
  const noServices = !state.services || state.services.length === 0;
  const noPackages = !state.packages || state.packages.length === 0;
  const noNodes = noPackages && noServices;
  const noNodeSelected = !state.nodeSelected;
  switch (action.type) {
    case UP_ARROW_PRESSED:
      if (noNodes) {
        return state;
      }
      const firstPackage = state.packages[0];
      const firstPackageSelected = state.nodeSelected === firstPackage.name;
      const getPreviousNode = (): string => {
        const isPackage = state.packages.some((node) => node.name === state.nodeSelected);
        const key = isPackage ? 'packages' : 'services';
        const firstService = state.services[0];
        const firstPackageSelected = state.nodeSelected === firstService.name;
        if (firstPackageSelected) {
          return state.packages[state.packages.length - 1].name;
        }
        const currentNode = state[key].find((node) => node.name === state.nodeSelected);
        const index = state[key].indexOf(currentNode as IService) - 1;
        return state[key][index].name;
      };
      return {
        services: [...state.services],
        packages: [...state.packages],
        nodeSelected: noNodeSelected || firstPackageSelected ? firstPackage.name : getPreviousNode(),
        actionPanelOpen: false,
        actionSelected: null,
      };
    case DOWN_ARROW_PRESSED:
      if (noNodes) {
        return state;
      }
      const lastNode = state.services[state.services.length - 1];
      const lastNodeSelected = state.nodeSelected === lastNode.name;
      const getNextNode = (): string => {
        const isPackage = state.packages.some((node) => node.name === state.nodeSelected);
        const key = isPackage ? 'packages' : 'services';
        const lastPackage = state.packages[state.packages.length - 1];
        const lastPackageSelected = state.nodeSelected === lastPackage.name;
        if (lastPackageSelected) {
          return state.services[0].name;
        }
        const currentNode = state[key].find((node) => node.name === state.nodeSelected);
        return state[key][state[key].indexOf(currentNode as IService) + 1].name;
      };
      return {
        services: [...state.services],
        packages: [...state.packages],
        nodeSelected: noNodeSelected || lastNodeSelected ? lastNode.name : getNextNode(),
        actionPanelOpen: false,
        actionSelected: null,
      };
    case ENTER_PRESSED:
    case ESCAPE_PRESSED:
    default:
      return state;
  }
};
