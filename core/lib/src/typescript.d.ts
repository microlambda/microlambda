import { CompilerOptions, ParsedCommandLine } from 'typescript';
import { Logger } from './logger';
export declare const getTsConfig: (cwd: string) => ParsedCommandLine;
export declare const compileFile: (cwd: string, absolutePath: string, compilerOptions: CompilerOptions, logger: Logger) => Promise<void>;
export declare const compileFiles: (cwd: string, logger: Logger) => Promise<void>;
