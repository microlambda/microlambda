import { Server } from 'http';
import { Logger, DependenciesGraph } from '@microlambda/core';
export * from './socket';
export declare const startServer: (graph: DependenciesGraph, logger: Logger) => Promise<Server>;
