export const log = {
  debug: (msg: unknown, ...args: unknown[]): void => {
    if (process.env.NODE_SLS_HELPERS_DEBUG) {
      // eslint-disable-next-line no-console
      console.debug('[SLS_HELPERS]', msg, ...args);
    }
  },
};
