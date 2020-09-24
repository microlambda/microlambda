import express from 'express';
import { createServer, Server } from 'http';
import { LernaGraph, Service } from '../lerna';

export const startServer = (graph: LernaGraph): Server => {
  // TODO: Resolve port from config, env, argv
  const port = 4545;
  const app = express();

  console.log(__dirname + '/static');
  app.use('/', express.static(__dirname + '/static'));

  app.get('/api/graph', (req, res) => {
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
    res.json(graph.logger.logs);
  });

  app.get('/api/services/:service/logs', (req, res) => {
    const serviceName = req.params.service;
    const service = graph.getServices().find(s => s.getName() === serviceName);
    if (!service) {
      return res.status(404);
    }
    return res.json(service.logs);
  });

  app.get('/api/nodes/:node/tsc/logs', (req, res) => {
    const nodeName = req.params.node;
    const node = graph.getNodes().find(s => s.getName() === nodeName);
    if (!node) {
      return res.status(404);
    }
    return res.json(node.tscLogs);
  });

  const http = createServer(app);
  http.listen(port, () => {
    console.log('Mila server running on port 4545');
  });
  return http;
};
