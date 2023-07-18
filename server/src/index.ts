import express, { Request } from 'express';
import { createServer, Server } from 'http';
import { Project, Scheduler, Workspace } from '@microlambda/core';
import cors from 'cors';
import { json } from 'body-parser';
import { INodeSummary } from '@microlambda/types';
import { EventsLog } from '@microlambda/logger';
import { getTrimmedSlice } from './utils/logs';

export * from './socket';

export const startServer = (
  port = 4545,
  project: Project,
  logger: EventsLog,
  scheduler: Scheduler,
): Promise<Server> => {
  const log = logger.scope('api');
  const app = express();

  app.use(
    cors({
      origin: ['http://localhost:4200', 'http://localhost:' + port],
      credentials: true,
    }),
  );
  app.use(json());

  app.use('/', express.static(__dirname + '/static'));

  app.get('/api/ping', (req, res) => {
    res.status(200).send('Pong');
  });

  app.get('/api/graph', async (req, res) => {
    const summaryMapper = (n: Workspace): INodeSummary => ({
      name: n.name,
      version: n.version || '',
      type: n.isService ? 'service' : 'package',
      port: n.isService ? n.ports?.http || null : null,
      enabled: n.hasCommand('start'),
      transpiled: n.transpiled,
      typeChecked: n.typechecked,
      status: n.started,
      children: Array.from(n.descendants.values()).map((n) => n.name),
      metrics: n.metrics,
    });
    const response: {
      packages: INodeSummary[];
      services: INodeSummary[];
    } = {
      packages: [...project.packages.values()].map(summaryMapper),
      services: [...project.services.values()].map(summaryMapper),
    };
    res.json(response);
  });

  const getSliceFromQuery = (req: Request): [number, number?] => {
    if (!req.query.slice) {
      return [0];
    }
    const rawSlice = req.query.slice.toString().split(',');
    if (rawSlice.length === 0 || rawSlice.length > 2 || rawSlice.some((str) => !Number.isInteger(Number(str)))) {
      log.warn('Invalid slice', rawSlice);
      return [0];
    }
    return rawSlice[1] ? [Number(rawSlice[0]), Number(rawSlice[1])] : [Number(rawSlice[0])];
  };

  app.get('/api/logs', (req, res) => {
    if (project.logger) {
      let logs = project.logger.buffer.filter((log) => ['warn', 'info', 'error', 'debug'].includes(log.level));
      if (req.query.scope && typeof req.query.scope === 'string') {
        logs = logs.filter((entry) => entry.scope?.includes(req.query.scope!.toString()));
      }
      return res.json(getTrimmedSlice(logs, getSliceFromQuery(req)));
    } else {
      return res.json({ data: [], metadata: { count: 0, slice: [0, 0] } });
    }
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
        return res.status(400).send('Invalid action');
    }
    return res.status(204).send();
  });

  app.get('/api/nodes/:node/tsc/logs', (req, res) => {
    const nodeName = req.params.node;
    const node = project.workspaces.get(nodeName);
    if (!node) {
      log.error('GET /api/nodes/:node/tsc/logs - 404 : No such node', nodeName);
      return res.status(404).send();
    }
    const logs: string[] | undefined = node.logs('in-memory')?.get('build') as string[] | undefined;
    if (logs) {
      return res.json(getTrimmedSlice(logs, getSliceFromQuery(req)));
    } else {
      return res.json({ data: [], metadata: { count: 0, slice: [0, 0] } });
    }
  });

  app.get('/api/services/:service/logs', (req, res) => {
    const serviceName = req.params.service;
    const service = project.services.get(serviceName);
    if (!service) {
      log.error('GET /api/services/:service/logs - 404: No such service');
      return res.status(404).send();
    }
    const logs: string[] | undefined = service.logs('in-memory')?.get('start') as string[] | undefined;
    if (logs) {
      return res.json(getTrimmedSlice(logs, getSliceFromQuery(req)));
    } else {
      return res.json({ data: [], metadata: { count: 0, slice: [0, 0] } });
    }
  });

  const http = createServer(app);
  return new Promise<Server>((resolve) => {
    http.listen(port, () => {
      resolve(http);
    });
  });
};
