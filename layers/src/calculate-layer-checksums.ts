import { Checksums, ISourcesChecksums, Workspace } from '@microlambda/runner-core';

export const calculateLayerChecksums = async (service: Workspace): Promise<ISourcesChecksums> => {
  return new Checksums(service, {
    cmd: 'create-layer',
    src: {
      internals: ['package.json'],
      deps: ['package.json'],
      root: ['package.json', 'yarn.lock'],
    }
  }).calculate();
};
