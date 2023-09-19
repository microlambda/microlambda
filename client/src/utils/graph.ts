import type { IGraph } from '../types/graph';

export const areGraphEquals = (g1: IGraph, g2: IGraph): boolean => {
  if (
    g1.services.length === g2.services.length &&
    g1.packages.length === g2.packages.length
  ) {
    return (
      g1.services.every((s1) => {
        const service = g2.services.find((s2) => s1.name === s2.name);
        if (service) {
          return (
            service.status === s1.status &&
            service.transpiled === s1.transpiled &&
            service.typeChecked === s1.typeChecked
          );
        }
        return false;
      }) &&
      g1.packages.every((p1) => {
        const pkg = g2.packages.find((p2) => p1.name === p2.name);
        if (pkg) {
          return (
            pkg.transpiled === p1.transpiled &&
            pkg.typeChecked === p1.typeChecked
          );
        }
        return false;
      })
    );
  }
  return false;
};
