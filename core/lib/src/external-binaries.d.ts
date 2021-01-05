import { Node } from './graph';
import { CompilationMode } from './config/config';
import { Logger } from './logger';
declare type Cmd = 'tsc' | 'sls' | 'lerna';
export declare const getBinary: (cmd: Cmd, projectRoot: string, logger: Logger, node?: Node) => string;
export declare const verifyBinaries: (mode: CompilationMode, projectRoot: string, logger: Logger) => Promise<void>;
export {};
