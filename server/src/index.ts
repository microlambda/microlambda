import express from 'express';
import { createServer, Server } from 'http';
import { Project, Scheduler, Workspace } from "@microlambda/core";
import cors from 'cors';
import { json } from 'body-parser';
import { INodeSummary } from '@microlambda/types';
import { Logger } from "@microlambda/logger";

export * from './socket';

export const startServer = (
  port = 4545,
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
    const summaryMapper = (n: Workspace): INodeSummary => ({
      name: n.name,
      version: n.version || '',
      type: n.isService ? 'service' : 'package',
      port: n.isService ? (n.ports?.http || null) : null,
      enabled: n.hasCommand('start'),
      transpiled: n.transpiled,
      typeChecked: n.typechecked,
      status: n.started,
      children: Array.from(n.descendants.values()).map((n) => n.name),
      metrics: n.metrics,
    })
    const response: {
      packages: INodeSummary[],
      services: INodeSummary[],
    } = {
      packages: [...project.packages.values()].map(summaryMapper),
      services: [...project.services.values()].map(summaryMapper),
    };
    res.json(response);
  });

  app.get('/api/logs', (req, res) => {
    log.debug('GET /api/logs');
    if (project.logger) {
      res.json(project.logger.buffer.filter((log) => ['warn', 'info', 'error', 'debug'].includes(log.level)));
    } else {
      res.json([]);
    }
  });

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
        scheduler.startAll();
        break;
      case 'stopAll':
        scheduler.stopAll();
        break;
      case 'restartAll':
        scheduler.restartAll();
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
        scheduler.startOne(service);
        break;
      case 'stop':
        scheduler.stopOne(service);
        break;
      case 'restart':
        scheduler.restartOne(service);
        break;
      /*case 'build':
        scheduler.typecheck(service, req.body?.options?.force);
        break;*/
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
  const http = createServer(app);
  return new Promise<Server>((resolve) => {
    http.listen(port, () => {
      console.debug('Listening on', port)
      resolve(http);
    });
  });
};
