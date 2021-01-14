import { all as merge } from 'deepmerge';
import { log } from './debug';

export interface IApiConfigCorsOptions {
  origin: string;
  credentials: boolean;
  methods: string[];
  allowHeaders: string[];
  exposeHeaders: string[];
  maxAge: string;
}

export interface IApiConfigOptions {
  cors: boolean | IApiConfigCorsOptions;
  blacklist: string[];
}

export interface IConfigOptions {
  api: IApiConfigOptions;
}

let internalConfig: IConfigOptions = {
  api: {
    blacklist: [],
    cors: false,
  },
};

export const config = (options: IConfigOptions): void => {
  log.debug('[CONFIG] Updating config with', options);
  internalConfig = merge([internalConfig, options]) as IConfigOptions;
  log.debug('[CONFIG] Used config', internalConfig);
};

export const getConfig = (): IConfigOptions => internalConfig;
