import { IConfig } from './config';
import fallback from './default.json';
import rc from 'rc';

export const loadConfig: () => IConfig = () => {
  return rc('microlambda', fallback) as IConfig;
};
