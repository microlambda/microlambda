/// <reference types="node" />
import { Server } from 'http';
import { DependenciesGraph, IEventLog, Logger, Node, RecompilationScheduler, Service, ServiceStatus, TranspilingStatus, TypeCheckStatus } from '@microlambda/core';
export declare class IOSocketManager {
    private _io;
    private _serviceToListen;
    private _scheduler;
    private _logger;
    private _graph;
    constructor(server: Server, scheduler: RecompilationScheduler, logger: Logger, graph: DependenciesGraph);
    statusUpdated(node: Service, status: ServiceStatus): void;
    transpilingStatusUpdated(node: Node, status: TranspilingStatus): void;
    typeCheckStatusUpdated(node: Node, status: TypeCheckStatus): void;
    eventLogAdded(log: IEventLog): void;
    handleServiceLog(service: string, data: string): void;
    handleTscLogs(node: string, data: string): void;
}
