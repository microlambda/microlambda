import { Project, Workspace, Ident } from '@yarnpkg/core';
import { RecompilationScheduler } from '../scheduler';
import { IConfig } from '../config/config';
import { Logger } from '../logger';
import { DependenciesGraph } from '../graph';
export declare const getYarnProject: (projectRoot: string) => Promise<Project>;
export declare const getName: (entity: Workspace | Ident) => string;
export declare const getGraphFromYarnProject: (projectRoot: string, scheduler: RecompilationScheduler, config: IConfig, logger: Logger, defaultPort?: number) => Promise<DependenciesGraph>;
