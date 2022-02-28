import express from 'express';
import { createServer, Server } from 'http';
import { Logger, Project, Scheduler } from '@microlambda/core';
import cors from 'cors';
import { json } from 'body-parser';
import { INodeSummary } from '@microlambda/types';

export * from './socket';

export const startServer = (
  port: number,
  project: Project,
  logger: Logger,
  scheduler: Scheduler,
): Promise<Server> => {
  const log = logger.log('api');
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
    const response: INodeSummary[] = Array.from(project.packages.values()).map((n) => ({
      name: n.name,
      version: n.version || '',
      type: n.isService ? 'service' : 'package',
      port: null, //n.isService ? graph.getPort(n.getName()).http : null, // FIXME: Not our responsibility anymore
      enabled: n.enabled,
      transpiled: n.transpiled,
      typeChecked: n.typechecked,
      status: n.started,
      children: Array.from(n.descendants.values()).map((n) => n.name),
      metrics: {
        lastTypeCheck: null, //n.metrics.lastTypeCheck ? n.metrics.lastTypeCheck.toISOString() : null,
        typeCheckTook: 0, //n.metrics.typeCheckTook,
        typeCheckFromCache: false, //n.metrics.typeCheckFromCache,
        lastTranspiled: null,// n.metrics.lastTranspiled ? n.metrics.lastTranspiled.toISOString() : null,
        transpileTook: 0, //n.metrics.transpileTook,
        lastStarted: null, //n.metrics.lastStarted ? n.metrics.lastStarted.toISOString() : null,
        startedTook: 0, //n.metrics.startedTook,
      },
    }));
    res.json(response);
  });

  /*
  FIXME: Events log equivalent
  app.get('/api/logs', (req, res) => {
    log.debug('GET /api/logs');
    if (project.logger) {
      res.json(graph.logger.logs.filter((log) => ['warn', 'info', 'error'].includes(log.level)));
    } else {
      res.json([]);
    }
  });*/

  app.get('/api/services/:service/logs', (req, res) => {
    const serviceName = req.params.service;
    log.debug('GET /api/services/:service/logs', serviceName);
    const service = project.services.get(serviceName);
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
    const service = project.services.get(serviceName);
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
        scheduler.typecheck(service, req.body?.options?.force);
        break;
      default:
        return res.status(422).send('Invalid action');
    }
    return res.status(204).send();
  });

  app.get('/api/nodes/:node/tsc/logs', (req, res) => {
    const nodeName = req.params.node;
    log.debug('GET /api/nodes/:node/tsc/logs', nodeName);
    const node = project.workspaces.get(nodeName);
    if (!node) {
      log.error('GET /api/nodes/:node/tsc/logs - 404 : No such node', nodeName);
      return res.status(404).send();
    }
    return res.json(node.logs('in-memory')?.get('build') || 'No logs in-memory found for target "build"');
  });

  app.get('/api/nodes/:node/tree', (req, res) => {
    const nodeName = req.params.node;
    log.debug('GET /api/nodes/:node/tree', nodeName);
    const node = project.workspaces.get(nodeName);
    if (!node) {
      log.error('GET /api/nodes/:node/tsc/logs - 404 : No such node', nodeName);
      return res.status(404).send();
    }
    return res.json(node.logs('in-memory'));
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
