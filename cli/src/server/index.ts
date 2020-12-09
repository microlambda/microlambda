import express from 'express';
import { createServer, Server } from 'http';
import { LernaGraph, Service } from '../lerna';
import { Logger } from '../utils/logger';

export const startServer = (graph: LernaGraph, logger: Logger): Promise<Server> => {
  const log = logger.log('api');
  // TODO: Arg de mila start --port
  const port = 4545;
  const app = express();

  app.use('/', express.static(__dirname + '/static'));

  app.get('/api/graph', (req, res) => {
    log.debug('GET /api/graph');
    res.json(
      graph.getNodes().map((n) => ({
        name: n.getName(),
        version: n.getVersion(),
        port: n.isService() ? graph.getPort(n.getName()) : null,
        enabled: n.isEnabled(),
        transpiled: n.getTranspilingStatus(),
        typeChecked: n.getTypeCheckStatus(),
        lastTypeCheck: n.lastTypeCheck,
        status: n.isService() ? (n as Service).getStatus() : null,
      })),
    );
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

  const http = createServer(app);
  return new Promise<Server>((resolve) => {
    http.listen(port, () => {
      resolve(http);
    });
  });
};
