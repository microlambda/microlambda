import { IGraphState, IService } from '../store';
import { Action } from 'redux';
import { DOWN_ARROW_PRESSED, ENTER_PRESSED, ESCAPE_PRESSED, Q_PRESSED, UP_ARROW_PRESSED } from '../actions/user-input';

export const userInputs = (state: IGraphState, action: Action): IGraphState => {
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
        if (noNodeSelected) {
          return state.services[state.services.length - 1].name;
        }
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
        nodeSelected: firstPackageSelected ? firstPackage.name : getPreviousNode(),
        scheduler: state.scheduler,
      };
    case DOWN_ARROW_PRESSED:
      if (noNodes) {
        return state;
      }
      const lastService = state.services[state.services.length - 1];
      const lastServiceSelected = state.nodeSelected === lastService.name;
      const getNextNode = (): string => {
        if (noNodeSelected) {
          return state.packages[0].name;
        }
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
        nodeSelected: lastServiceSelected ? lastService.name : getNextNode(),
        scheduler: state.scheduler,
      };
    case Q_PRESSED:
      if (state.scheduler && !state.nodeSelected) {
        state.scheduler.gracefulShutdown().subscribe(() => {
          setTimeout(() => process.exit(0), 200);
        });
      }
      return state;
    case ESCAPE_PRESSED:
      if (!state.nodeSelected) {
        // TODO: Put process in background
        return state;
      }
      return {
        services: [...state.services],
        packages: [...state.packages],
        nodeSelected: null,
        scheduler: state.scheduler,
      };
    case ENTER_PRESSED:
    default:
      return state;
  }
};
