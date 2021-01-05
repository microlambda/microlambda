"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startServer = void 0;
const tslib_1 = require("tslib");
const express_1 = tslib_1.__importDefault(require("express"));
const http_1 = require("http");
tslib_1.__exportStar(require("./socket"), exports);
exports.startServer = (graph, logger) => {
    const log = logger.log('api');
    const port = 4545;
    const app = express_1.default();
    app.use('/', express_1.default.static(__dirname + '/static'));
    app.get('/api/graph', (req, res) => {
        log.debug('GET /api/graph');
        res.json(graph.getNodes().map((n) => ({
            name: n.getName(),
            version: n.getVersion(),
            port: n.isService() ? graph.getPort(n.getName()) : null,
            enabled: n.isEnabled(),
            transpiled: n.getTranspilingStatus(),
            typeChecked: n.getTypeCheckStatus(),
            lastTypeCheck: n.lastTypeCheck,
            status: n.isService() ? n.getStatus() : null,
        })));
    });
    app.get('/api/logs', (req, res) => {
        log.debug('GET /api/logs');
        res.json(graph.logger.logs);
    });
    app.get('/api/services/:service/logs', (req, res) => {
        const serviceName = req.params.service;
        log.debug('GET /api/services/:service/logs', serviceName);
        const service = graph.getServices().find((s) => s.getName() === serviceName);
        if (!service) {
            log.error('GET /api/services/:service/logs - 404: No such service');
            return res.status(404);
        }
        return res.json(service.logs);
    });
    app.get('/api/nodes/:node/tsc/logs', (req, res) => {
        const nodeName = req.params.node;
        log.debug('GET /api/nodes/:node/tsc/logs', nodeName);
        const node = graph.getNodes().find((s) => s.getName() === nodeName);
        if (!node) {
            log.error('GET /api/nodes/:node/tsc/logs - 404 : No such node', nodeName);
            return res.status(404).send();
        }
        return res.json(node.tscLogs);
    });
    app.get('/api/nodes/:node/tree', (req, res) => {
        const nodeName = req.params.node;
        log.debug('GET /api/nodes/:node/tree', nodeName);
        const node = graph.getNodes().find((s) => s.getName() === nodeName);
        if (!node) {
            log.error('GET /api/nodes/:node/tsc/logs - 404 : No such node', nodeName);
            return res.status(404).send();
        }
        return res.json(node.tscLogs);
    });
    const http = http_1.createServer(app);
    return new Promise((resolve) => {
        http.listen(port, () => {
            resolve(http);
        });
    });
};
//# sourceMappingURL=index.js.map