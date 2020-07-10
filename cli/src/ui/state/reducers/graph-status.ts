import { IGraphState } from '../store';
import { IGraphAction } from '../actions/graph-updated';

export const graphStatus = (state: IGraphState, action: IGraphAction): IGraphState => {
  switch (action.type) {
    case 'SET_GRAPH':
      return {
        packages: action.graph.getPackages().map((pkg) => ({
          enabled: pkg.isEnabled(),
          version: pkg.getVersion(),
          name: pkg.getName(),
          compilationStatus: pkg.getCompilationStatus(),
        })),
        services: action.graph.getServices().map((pkg) => ({
          enabled: pkg.isEnabled(),
          name: pkg.getName(),
          version: pkg.getVersion(),
          compilationStatus: pkg.getCompilationStatus(),
          status: pkg.getStatus(),
          port: action.graph.getPort(pkg.getName()),
        })),
        nodeSelected: state.nodeSelected,
      };
    case 'UPDATE_PACKAGE_STATUS':
      const packages = [...state.packages];
      const toUpdate = packages.find((pkg) => pkg.name === action.node.getName());
      if (toUpdate) {
        toUpdate.compilationStatus = action.node.getCompilationStatus();
        toUpdate.enabled = action.node.isEnabled();
      }
      return {
        services: [...state.services],
        packages,
        nodeSelected: state.nodeSelected,
      };
    case 'UPDATE_SERVICE_STATUS':
      const services = [...state.services];
      const serviceToUpdate = services.find((pkg) => pkg.name === action.service.getName());
      if (serviceToUpdate) {
        serviceToUpdate.compilationStatus = action.service.getCompilationStatus();
        serviceToUpdate.status = action.service.getStatus();
        serviceToUpdate.enabled = action.service.isEnabled();
      }
      return {
        packages: [...state.packages],
        services,
        nodeSelected: state.nodeSelected,
      };
    default:
      return state;
  }
};
