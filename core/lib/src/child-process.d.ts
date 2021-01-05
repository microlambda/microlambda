import { SpawnOptions } from 'child_process';
import { Logger } from './logger';
declare type Verbosity = 'silly' | 'debug' | 'info' | 'warn' | 'error';
export declare const execCmd: (cmd: string, args: ReadonlyArray<string>, options: SpawnOptions, stdout: Verbosity, stderr: Verbosity, logger: Logger) => Promise<string>;
export {};
