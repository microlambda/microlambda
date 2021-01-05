import { Observable } from 'rxjs';
import { Logger } from './logger';
import { DependenciesGraph, Node, Service } from './graph';
export declare enum RecompilationEventType {
    STOP_IN_PROGRESS = 0,
    STOP_SUCCESS = 1,
    STOP_FAILURE = 2,
    TRANSPILE_IN_PROGRESS = 3,
    TRANSPILE_SUCCESS = 4,
    TRANSPILE_FAILURE = 5,
    TYPE_CHECK_IN_PROGRESS = 6,
    TYPE_CHECK_SUCCESS = 7,
    TYPE_CHECK_FAILURE = 8,
    START_IN_PROGRESS = 9,
    START_SUCCESS = 10,
    START_FAILURE = 11,
    PACKAGE_IN_PROGRESS = 12,
    PACKAGE_SUCCESS = 13,
    PACKAGE_FAILURE = 14,
    DEPLOY_IN_PROGRESS = 15,
    DEPLOY_SUCCESS = 16,
    DEPLOY_FAILURE = 17
}
export declare enum RecompilationErrorType {
    TYPE_CHECK_ERROR = 0,
    PACKAGE_ERROR = 1
}
export declare enum RecompilationMode {
    FAST = 0,
    SAFE = 1
}
export interface IRecompilationEvent {
    type: RecompilationEventType;
    node: Node;
    took?: number;
    megabytes?: number;
}
export interface IRecompilationError {
    type: RecompilationErrorType;
    node: Node;
    logs: string[];
}
export declare class RecompilationScheduler {
    private _graph;
    private _jobs;
    private _status;
    private _recompilation;
    private _abort$;
    private _filesChanged$;
    private _changes;
    private _debounce;
    private _logger;
    private _concurrency;
    constructor(logger: Logger);
    setGraph(graph: DependenciesGraph): void;
    setConcurrency(threads: number): void;
    startOne(service: Service): Observable<IRecompilationEvent>;
    startAll(): Observable<IRecompilationEvent>;
    stopOne(service: Service): Observable<IRecompilationEvent>;
    gracefulShutdown(): Observable<IRecompilationEvent>;
    stopAll(): Observable<IRecompilationEvent>;
    restartOne(service: Service, recompile?: boolean): Observable<IRecompilationEvent>;
    restartAll(recompile?: boolean): Observable<IRecompilationEvent>;
    startProject(graph: DependenciesGraph, compile?: boolean): Promise<void>;
    stopProject(graph: DependenciesGraph): Promise<void>;
    fileChanged(node: Node): void;
    private _watchFileChanges;
    recompileSafe(node: Node, force?: boolean): void;
    private _compile;
    private _reset;
    private _requestStop;
    private _requestTypeCheck;
    private _requestTranspile;
    private _requestStart;
    private _requestPackage;
    private _alreadyQueued;
    private _execPromise;
    private _exec;
    buildOne(service: Node, onlySelf: boolean, force: boolean): Observable<IRecompilationEvent>;
    buildAll(graph: DependenciesGraph, onlySelf: boolean, force: boolean): Observable<IRecompilationEvent>;
    packageOne(service: Service, level?: number): Observable<IRecompilationEvent>;
    packageAll(graph: DependenciesGraph, level?: number): Observable<IRecompilationEvent>;
}
