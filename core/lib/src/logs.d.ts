import { Logger } from './logger';
export declare const getLogsDirectory: (projectRoot: string) => string;
export declare const getLogsPath: (projectRoot: string, service: string, type: 'offline' | 'deploy' | 'createDomain') => string;
export declare const recreateLogDirectory: (projectRoot: string, logger: Logger) => void;
export declare const createLogFile: (projectRoot: string, service: string, type: 'offline' | 'deploy' | 'createDomain') => void;
export declare const tailLogs: (serviceName: string, projectRoot: string, logger: Logger) => void;
