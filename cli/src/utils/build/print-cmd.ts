import { logger } from '../logger';

export const printCommand = (action: string, service?: string, only = true) => {
  if (service) {
    if (only) {
      logger.info('🔧 Building only', service);
    } else {
      logger.info('🔧 Building', service, 'and its dependencies');
    }
  } else {
    logger.info('🔧 Building all project services');
  }
}
