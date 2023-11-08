import { inspect } from 'util';

export const stringify = (input: unknown): string => {
  if (typeof input === 'object') {
    return inspect(input, { depth: 10 });
  }
  if (Array.isArray(input)) {
    return inspect(input, { depth: 10 });
  }
  return String(input);
};
