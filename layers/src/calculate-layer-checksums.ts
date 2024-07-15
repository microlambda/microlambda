import { Checksums, ISourcesChecksums, Workspace } from '@microlambda/runner-core';

export const calculateLayerChecksums = async (service: Workspace): Promise<ISourcesChecksums> => {
  return new Checksums(service, {
    cmd: 'create-layer',
    src: {
      internals: ['package.json', 'package-lock.json', 'pnpm-lock.yaml'],
      deps: ['package.json'],
      root: ['package.json', 'yarn.lock', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'],
    },
  }).calculate();
};
