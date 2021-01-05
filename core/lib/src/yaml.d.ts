import { Schema } from 'js-yaml';
import { Service } from './graph';
import { ConfigReader } from './config/read-config';
export declare const CUSTOM_SCHEMA: Schema;
export declare const parseServerlessYaml: (path: string) => any;
export declare const backupYaml: (services: Service[]) => void;
export declare const restoreYaml: (services: Service[]) => void;
export declare const reformatYaml: (projectRoot: string, config: ConfigReader, services: Service[], region: string, env: string) => Promise<void>;
export declare const getServiceName: (service: Service) => string;
