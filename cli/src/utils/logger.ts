export const log = (...args: any) => {
  if (process.env.MLDA_DEBUG) {
    console.debug(...args);
  }
};
