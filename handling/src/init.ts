import { log } from './debug';

const globalInitializers: Function[] = [];

export const runInitializers = async (): Promise<unknown[]> => {
  log.debug(`[INIT] Running ${globalInitializers.length} initializer`);
  return Promise.all(globalInitializers.map((initializer) => initializer()));
};

export const init = (initializer: Function): void => {
  log.debug('[INIT] Adding initializer', initializer.name);
  globalInitializers.push(initializer);
};
