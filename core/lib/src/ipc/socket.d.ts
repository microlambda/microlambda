import { Observable } from 'rxjs';
import { RecompilationScheduler } from '../scheduler';
import { Logger } from '../logger';
import { TranspilingStatus } from '../graph';
import { ServiceStatus } from '../graph';
import { DependenciesGraph } from '../graph';
interface IGraphStatus {
    name: string;
    compiled: TranspilingStatus;
    status: ServiceStatus;
}
export declare class IPCSocketsManager {
    private _ipc;
    private _graph;
    private readonly _id;
    private _sockets;
    private readonly _scheduler;
    private readonly _logger;
    constructor(projectRoot: string, scheduler: RecompilationScheduler, logger: Logger, graph?: DependenciesGraph);
    createServer(): Promise<void>;
    private _startOne;
    private _startAll;
    private _findService;
    private _emitEvent;
    private _emitSuccess;
    private _emitFailure;
    private _stopOne;
    private _stopAll;
    private _restartOne;
    private _restartAll;
    subscribeStatus(): Observable<IGraphStatus>;
    graphUpdated(): void;
    requestStop(service?: string): Promise<void>;
    requestStart(service?: string): Promise<void>;
    requestRestart(service?: string): Promise<void>;
    private _requestAction;
    private static _requestEvent;
    private static _responseEvent;
    private static _errorEvent;
    private _emitGraph;
}
export {};
