import { Logger } from '../logger';
import { DependenciesGraph, Service } from '../graph';
export interface IPackage {
    name: string;
    version: string;
    path: string;
    children: IPackage[];
    parent: IPackage;
    local: boolean;
    duplicate?: boolean;
}
export declare type Tree = IPackage[];
export declare class Packager {
    private readonly _tree;
    private readonly _shaken;
    private readonly _services;
    private readonly _graph;
    private readonly _logger;
    constructor(graph: DependenciesGraph, services: Service[] | Service, logger: Logger);
    getTree(serviceName: string): Tree;
    setTree(serviceName: string, tree: Tree): void;
    bundle(restore?: boolean, level?: number, stdio?: 'ignore' | 'inherit'): Promise<void>;
    generateZip(service: Service, level: number, restore: boolean, stdio: 'ignore' | 'inherit'): Promise<number>;
    print(service: Service, printDuplicates?: boolean): string;
}
