"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IPCSocketsManager = void 0;
const node_ipc_1 = require("node-ipc");
const rxjs_1 = require("rxjs");
const scheduler_1 = require("../scheduler");
const uuid_1 = require("uuid");
class IPCSocketsManager {
    constructor(projectRoot, scheduler, logger, graph) {
        this._ipc = new node_ipc_1.IPC();
        this._sockets = [];
        this._logger = logger;
        this._logger.log('ipc').debug('Creating socket', projectRoot);
        this._ipc.config.silent = !process.env.MILA_DEBUG;
        this._ipc.config.appspace = 'mila.';
        this._graph = graph;
        const projectPathSegments = projectRoot.split('/');
        this._logger.log('ipc').debug('Path', projectPathSegments);
        this._id = projectPathSegments[projectPathSegments.length - 1];
        this._logger.log('ipc').debug('ID', this._id);
        this._ipc.config.id = this._id;
        this._scheduler = scheduler;
    }
    async createServer() {
        return new Promise((resolve) => {
            this._ipc.serve(() => {
                this._logger.log('ipc').debug('socket created');
                resolve();
            });
            this._ipc.server.on('connect', (socket) => {
                this._sockets.push(socket);
                this._emitGraph(socket);
            });
            this._ipc.server.on('requestStart', (request) => {
                if (request.service) {
                    this._startOne(request.service, request.execId);
                }
                else {
                    this._startAll(request.execId);
                }
            });
            this._ipc.server.on('requestStop', (request) => {
                if (request.service) {
                    this._stopOne(request.service, request.execId);
                }
                else {
                    this._stopAll(request.execId);
                }
            });
            this._ipc.server.on('requestRestart', (request) => {
                if (request.service) {
                    this._restartOne(request.service, request.execId);
                }
                else {
                    this._restartAll(request.execId);
                }
            });
            this._ipc.server.start();
        });
    }
    _startOne(service, execId) {
        const toStart = this._findService(service, 'start');
        if (toStart) {
            this._scheduler.startOne(toStart).subscribe((event) => this._emitEvent(event), (err) => this._emitFailure(execId, err), () => this._emitSuccess(execId));
        }
    }
    _startAll(execId) {
        this._scheduler.startAll().subscribe((event) => this._emitEvent(event), (err) => this._emitFailure(execId, err), () => this._emitSuccess(execId));
    }
    _findService(name, action) {
        const service = this._graph.getServices().find((s) => s.getName() === name);
        if (!service) {
            this._ipc.server.emit(IPCSocketsManager._errorEvent(action), {
                name,
                error: 'Cannot find service ' + name,
            });
            return null;
        }
        return service;
    }
    _emitEvent(recompilationEvent) {
        switch (recompilationEvent.type) {
            case scheduler_1.RecompilationEventType.START_SUCCESS:
                this._ipc.server.emit(IPCSocketsManager._responseEvent('start'), {
                    node: recompilationEvent.node.getName(),
                    port: this._graph.getPort(recompilationEvent.node.getName()),
                });
                break;
            case scheduler_1.RecompilationEventType.STOP_SUCCESS:
                this._ipc.server.emit(IPCSocketsManager._responseEvent('stop'), {
                    node: recompilationEvent.node.getName(),
                });
                break;
        }
    }
    _emitSuccess(execId) {
        this._ipc.server.emit(`succeed-${execId}`, {});
    }
    _emitFailure(execId, err) {
        this._ipc.server.emit(`failed-${execId}`, err);
    }
    _stopOne(service, execId) {
        const toStop = this._findService(service, 'stop');
        if (toStop) {
            this._scheduler.stopOne(toStop).subscribe((event) => this._emitEvent(event), (err) => this._emitFailure(execId, err), () => this._emitSuccess(execId));
        }
    }
    _stopAll(execId) {
        this._scheduler.stopAll().subscribe((event) => this._emitEvent(event), (err) => this._emitFailure(execId, err), () => this._emitSuccess(execId));
    }
    _restartOne(service, execId) {
        const toRestart = this._findService(service, 'restart');
        if (toRestart) {
            this._scheduler.restartOne(toRestart).subscribe((event) => this._emitEvent(event), (err) => this._emitFailure(execId, err), () => this._emitSuccess(execId));
        }
    }
    _restartAll(execId) {
        this._scheduler.restartAll().subscribe((event) => this._emitEvent(event), (err) => this._emitFailure(execId, err), () => this._emitSuccess(execId));
    }
    subscribeStatus() {
        const graphStatus = new rxjs_1.Subject();
        this._ipc.connectTo(this._id, () => {
            this._logger.log('ipc').debug('socket connected');
            this._ipc.of[this._id].on('status', (data) => {
                graphStatus.next(data);
            });
        });
        return graphStatus.asObservable();
    }
    graphUpdated() {
        this._sockets.forEach((s) => this._emitGraph(s));
    }
    async requestStop(service) {
        return this._requestAction('stop', service);
    }
    async requestStart(service) {
        return this._requestAction('start', service);
    }
    async requestRestart(service) {
        return this._requestAction('restart', service);
    }
    async _requestAction(action, service) {
        const execId = uuid_1.v4();
        return new Promise((resolve, reject) => {
            this._ipc.connectTo(this._id, () => {
                this._logger.log('ipc').debug('socket connected');
                this._ipc.of[this._id].emit(IPCSocketsManager._requestEvent(action), {
                    service,
                    execId,
                });
                this._ipc.of[this._id].on(IPCSocketsManager._responseEvent(action), (data) => {
                    if (!service || service === data.service) {
                        switch (action) {
                            case 'start':
                                this._logger.log('ipc').info(`${data.service} started on port ${data.port}`);
                                break;
                            case 'stop':
                                this._logger.log('ipc').info(`${data.service} stopped`);
                                break;
                            case 'restart':
                                this._logger.log('ipc').info(`${data.service} restarted on port ${data.port}`);
                                break;
                        }
                    }
                });
                this._ipc.of[this._id].on(IPCSocketsManager._errorEvent(action), (data) => {
                    if (!service || service === data.service) {
                        switch (action) {
                            case 'start':
                                this._logger.log('ipc').error(`Error starting ${data.service}`);
                                break;
                            case 'stop':
                                this._logger.log('ipc').error(`Error stopping ${data.service}`);
                                break;
                            case 'restart':
                                this._logger.log('ipc').error(`Error restarting ${data.service}`);
                                break;
                        }
                        this._logger.log('ipc').error(data.error);
                    }
                });
                this._ipc.of[this._id].on(`succeed-${execId}`, () => resolve());
                this._ipc.of[this._id].on(`failed-${execId}`, () => reject());
            });
        });
    }
    static _requestEvent(action) {
        switch (action) {
            case 'start':
                return 'requestStart';
            case 'stop':
                return 'requestStop';
            case 'restart':
                return 'requestRestart';
            default:
                throw Error(`Invalid action ${action}`);
        }
    }
    static _responseEvent(action) {
        switch (action) {
            case 'start':
                return 'started';
            case 'stop':
                return 'stopped';
            case 'restart':
                return 'restarted';
            default:
                throw Error(`Invalid action ${action}`);
        }
    }
    static _errorEvent(action) {
        switch (action) {
            case 'start':
                return 'errorStarting';
            case 'stop':
                return 'errorStopping';
            case 'restart':
                return 'errorRestarting';
            default:
                throw Error(`Invalid action ${action}`);
        }
    }
    _emitGraph(socket) {
        this._ipc.server.emit(socket, 'status', this._graph.getNodes().map((n) => ({
            name: n.getName(),
            compiled: n.getTranspilingStatus(),
            status: n.isService() ? n.getStatus() : null,
        })));
    }
}
exports.IPCSocketsManager = IPCSocketsManager;
//# sourceMappingURL=socket.js.map