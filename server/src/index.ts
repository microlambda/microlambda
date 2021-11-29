import express from 'express';
import { createServer, Server } from 'http';
import { Logger, Project } from '@microlambda/core';
import cors from 'cors';
import { json } from 'body-parser';
import { INodeSummary } from '@microlambda/types';

export * from './socket';

export const startServer = (
  port: number,
  project: Project,
  logger: Logger,
): Promise<Server> => {
  const log = logger.log('api');
  // TODO: Arg de mila start --port
  const app = express();

  app.use(
    cors({
      origin: ['http://localhost:4200', 'http://localhost:' + port],
      credentials: true,
    }),
  );
  app.use(json());

  app.use('/', express.static(__dirname + '/static'));

  app.get('/api/graph', (req, res) => {
    log.debug('GET /api/graph');
    const response: INodeSummary[] = graph.getNodes().map((n) => ({
      name: n.getName(),
      version: n.getVersion() || '',
      type: n.isService() ? 'service' : 'package',
      port: n.isService() ? graph.getPort(n.getName()).http : null,
      enabled: n.isEnabled(),
      transpiled: n.getTranspilingStatus(),
      typeChecked: n.getTypeCheckStatus(),
      status: n.isService() ? (n as Service).status : null,
      children: n.getChildren().map((n) => n.getName()),
      metrics: {
        lastTypeCheck: n.metrics.lastTypeCheck ? n.metrics.lastTypeCheck.toISOString() : null,
        typeCheckTook: n.metrics.typeCheckTook,
        typeCheckFromCache: n.metrics.typeCheckFromCache,
        lastTranspiled: n.metrics.lastTranspiled ? n.metrics.lastTranspiled.toISOString() : null,
        transpileTook: n.metrics.transpileTook,
        lastStarted: n.metrics.lastStarted ? n.metrics.lastStarted.toISOString() : null,
        startedTook: n.metrics.startedTook,
      },
    }));
    res.json(response);
  });

  app.get('/api/logs', (req, res) => {
    log.debug('GET /api/logs');
    if (graph.logger) {
      res.json(graph.logger.logs.filter((log) => ['warn', 'info', 'error'].includes(log.level)));
    } else {
      res.json([]);
    }
  });

  app.get('/api/services/:service/logs', (req, res) => {
    const serviceName = req.params.service;
    log.debug('GET /api/services/:service/logs', serviceName);
    const service = graph.getServices().find((s) => s.getName() === serviceName);
    if (!service) {
      log.error('GET /api/services/:service/logs - 404: No such service');
      return res.status(404).send();
    }
    return res.json(service.logs);
  });

  app.put('/api/graph', (req, res) => {
    log.debug('PUT /api/graph/');
    log.debug('Body', req.body);
    switch (req.body?.action) {
      case 'startAll':
        scheduler.startAll().subscribe();
        break;
      case 'stopAll':
        scheduler.stopAll().subscribe();
        break;
      case 'restartAll':
        scheduler.restartAll().subscribe();
        break;
      default:
        return res.status(422).send('Invalid action');
    }
    return res.status(204).send();
  });

  app.put('/api/services/:service', (req, res) => {
    const serviceName = req.params.service;
    log.debug('PUT /api/services/:service', serviceName);
    log.debug('Body', req.body);
    const service = graph.getServices().find((s) => s.getName() === serviceName);
    if (!service) {
      log.error('GET /api/services/:service/logs - 404: No such service');
      return res.status(404).send();
    }
    switch (req.body?.action) {
      case 'start':
        scheduler.startOne(service).subscribe();
        break;
      case 'stop':
        scheduler.stopOne(service).subscribe();
        break;
      case 'restart':
        scheduler.restartOne(service).subscribe();
        break;
      case 'build':
        scheduler.recompileSafe(service, req.body?.options?.force);
        break;
      default:
        return res.status(422).send('Invalid action');
    }
    return res.status(204).send();
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
  app.get('/api/scheduler/status', (req, res) => {
    return res.json({ status: scheduler.status });
  });

  const http = createServer(app);
  return new Promise<Server>((resolve) => {
    http.listen(port, () => {
      resolve(http);
    });
  });
};
