import { DependenciesGraph, Node, ServiceStatus } from './';
import { Observable } from 'rxjs';
import { RecompilationScheduler } from '../scheduler';
import { Project, Workspace } from '@yarnpkg/core';
interface IServiceLogs {
    offline: string[];
    createDomain: string[];
    deploy: string[];
}
export declare class Service extends Node {
    private status;
    private readonly _port;
    private process;
    private logStream;
    private readonly _logs;
    private _slsYamlWatcher;
    private _slsLogs$;
    private _status$;
    status$: Observable<ServiceStatus>;
    slsLogs$: Observable<string>;
    constructor(scheduler: RecompilationScheduler, graph: DependenciesGraph, workspace: Workspace, nodes: Set<Node>, project: Project);
    getStatus(): ServiceStatus;
    get logs(): IServiceLogs;
    get port(): number;
    stop(): Observable<Service>;
    start(): Observable<Service>;
    private _watchServerlessYaml;
    protected _unwatchServerlessYaml(): Promise<void>;
    private _startProcess;
    private _watchStarted;
    private _handleLogs;
    private _updateStatus;
    isRunning(): boolean;
    package(restore?: boolean, level?: number): Observable<{
        service: Service;
        megabytes: number;
    }>;
    deploy(region: string, stage: string): Promise<void>;
    createCustomDomain(region: string, stage: string): Promise<void>;
}
export {};
