import pino from 'pino';

const logLevel = (): string => {
  switch (process.env.env) {
    case 'test':
      return 'silent';
    case 'production':
      return 'info';
    default:
      return 'debug';
  }
};

export const logger: pino.Logger = pino({
  prettyPrint: true,
  level: logLevel(),
});
