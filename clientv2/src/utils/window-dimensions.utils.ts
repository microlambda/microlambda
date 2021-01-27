import { logger } from '../logger';

const log = logger.scope('(window)');

export const calculateDimensions = (elt: HTMLElement) => {
  if (!elt) {
    return { height: 0, width: 0 };
  }
  const rect = elt.getBoundingClientRect();
  log.debug('window size', window.innerWidth, 'x', window.innerHeight);
  log.debug(rect);
  const height = window.innerHeight - rect.top;
  const width = window.innerWidth - rect.left;
  return { height, width };
};
