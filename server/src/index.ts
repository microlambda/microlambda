import express, { Request } from 'express';
import { createServer, Server } from 'http';
import { Project, Scheduler, Workspace } from '@microlambda/core';
import cors from 'cors';
import { json } from 'body-parser';
import { INodeSummary } from '@microlambda/types';
import { EventsLog } from '@microlambda/logger';
import { getTrimmedSlice } from './utils/logs';
import { EnvironmentLoader, SSMResolverMode, ILoadedEnvironmentVariable } from '@microlambda/environments';
import { State } from '@microlambda/remote-state';
import { IRootConfig } from '@microlambda/config';
import { aws } from '@microlambda/aws';

export * from './socket';

export const startServer = (options: {
  port: number;
  project: Project;
  logger: EventsLog;
  scheduler: Scheduler;
  config: IRootConfig;
}): Promise<Server> => {
  const { port, project, logger, scheduler } = options;
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
      hasTargets: {
        build: n.hasCommand('build'),
        start: n.hasCommand('start'),
      },
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

  app.get('/api/aws/account', async (req, res) => {
    const account = await aws.iam.getCurrentUser(options.config.defaultRegion);
    res.json(account);
  });

  app.get('/api/environments', async (req, res) => {
    const state = new State(options.config);
    const envs = await state.listEnvironments();
    return res.json(envs);
  });

  app.get('/api/services/:service/environment', async (req, res) => {
    const serviceName = req.params.service;
    const loader = new EnvironmentLoader(project);
    const state = new State(options.config);
    const envs = await state.listEnvironments();
    const vars: Record<string, Array<ILoadedEnvironmentVariable>> = {};
    const loadEnvironments$ = envs.map((env) =>
      loader
        .loadAll({
          env: env.name,
          service: serviceName,
          inject: false,
          shouldInterpolate: true,
          ssmMode: SSMResolverMode.IGNORE,
          overwrite: false,
        })
        .then((loaded) => {
          vars[env.name] = loaded;
        }),
    );
    await Promise.all(loadEnvironments$);
    return res.json(vars);
  });

  const http = createServer(app);
  return new Promise<Server>((resolve) => {
    http.listen(port, () => {
      resolve(http);
    });
  });
};
