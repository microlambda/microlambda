"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IOSocketManager = void 0;
const tslib_1 = require("tslib");
const socket_io_1 = tslib_1.__importDefault(require("socket.io"));
class IOSocketManager {
    constructor(server, scheduler, logger, graph) {
        this._scheduler = scheduler;
        this._logger = logger;
        this._io = socket_io_1.default(server);
        this._graph = graph;
        this._io.on('connection', (socket) => {
            socket.on('service.start', (serviceName) => {
                this._logger.log('io').info('received service.start request', serviceName);
                const service = this._graph.getServices().find((s) => s.getName() === serviceName);
                if (!service) {
                    this._logger.log('io').error('unknown service', serviceName);
                }
                else {
                    this._scheduler.startOne(service).subscribe(() => {
                        this._logger.log('io').info('service started');
                    });
                }
            });
            socket.on('service.restart', (serviceName) => {
                this._logger.log('io').info('received service.restart request', serviceName);
                const service = this._graph.getServices().find((s) => s.getName() === serviceName);
                if (!service) {
                    this._logger.log('io').error('unknown service', serviceName);
                }
                else {
                    this._scheduler.restartOne(service).subscribe(() => {
                        this._logger.log('io').info('service restarted');
                    });
                }
            });
            socket.on('service.stop', (serviceName) => {
                this._logger.log('io').info('received service.stop request', serviceName);
                const service = this._graph.getServices().find((s) => s.getName() === serviceName);
                if (!service) {
                    this._logger.log('io').error('unknown service', serviceName);
                }
                else {
                    this._scheduler.stopOne(service).subscribe(() => {
                        this._logger.log('io').info('service stopped');
                    });
                }
            });
            socket.on('node.compile', (data) => {
                this._logger.log('io').info('received node.compile request', data.node);
                const node = this._graph.getNodes().find((s) => s.getName() === data.node);
                if (!node) {
                    this._logger.log('io').error('unknown node', data.node);
                }
                else {
                    this._scheduler.recompileSafe(node, data.force);
                }
            });
            socket.on('send.service.logs', (service) => {
                this._serviceToListen = service;
            });
        });
    }
    statusUpdated(node, status) {
        this._io.emit('node.status.updated', { node: node.getName(), status });
    }
    transpilingStatusUpdated(node, status) {
        this._io.emit('transpiling.status.updated', { node: node.getName(), status });
    }
    typeCheckStatusUpdated(node, status) {
        this._io.emit('type.checking.status.updated', { node: node.getName(), status });
    }
    eventLogAdded(log) {
        this._io.emit('event.log.added', log);
    }
    handleServiceLog(service, data) {
        if (this._serviceToListen === service) {
            this._io.emit(service + '.log.added', data);
        }
    }
    handleTscLogs(node, data) {
        this._io.emit('tsc.log.emitted', { node, data });
    }
}
exports.IOSocketManager = IOSocketManager;
//# sourceMappingURL=socket.js.map