import { blue, green, yellow, red } from 'chalk';

export const log = {
  debug: (...args: any[]) => {
    if (process.env.MILA_DEBUG) {
      console.debug(blue('[DEBUG]'), ...args);
    }
  },
  info: (...args: any[]) => {
    console.info(green('[INFO]'), ...args);
  },
  warn: (...args: any[]) => {
    console.info(yellow('[WARNING]', ...args));
  },
  error: (...args: any[]) => {
    console.info(red('[ERROR]', ...args));
  }
};
