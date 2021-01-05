import { IConfig } from './config/config';
import { Logger } from './logger';
import { Workspace } from '@yarnpkg/core';
declare type PortMap = {
    [key: string]: number;
};
export declare const resolvePorts: (services: Workspace[], config: IConfig, logger: Logger, defaultPort?: number) => PortMap;
export {};
