import { blue, cyan, green, red, yellow } from 'chalk';
import { Prefixes } from './options';

export const DEFAULT_BUFFER_SIZE = 200000;
export const DEFAULT_INSPECT_DEPTH = 20;
export const DEFAULT_PREFIXES: Prefixes = {
  silly: cyan('[silly]'),
  debug: blue('[debug]'),
  info: green('[info]'),
  warn: yellow('[warn]'),
  error: red('[error]'),
};
