import express from 'express';
import { createServer, Server } from 'http';
import { Project, Scheduler, Workspace } from '@microlambda/core';
import cors from 'cors';
import { json } from 'body-parser';
import { INodeSummary } from '@microlambda/types';
import { EventsLog } from '@microlambda/logger';
import { EnvironmentLoader, SSMResolverMode, ILoadedEnvironmentVariable } from '@microlambda/environments';
import { State } from '@microlambda/remote-state';
import { IRootConfig, IStateConfig } from '@microlambda/config';
import { aws } from '@microlambda/aws';

export * from './socket';

export const startServer = (options: {
  port: number;
  project: Project;
  logger: EventsLog;
  scheduler: Scheduler;
  config?: IStateConfig;
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

  app.get('/api/logs', (req, res) => {
    if (project.logger) {
      const logs = project.logger.getLogs();
      return res.json(logs ?? []);
    } else {
      return res.json([]);
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
    return res.json(logs ?? []);
  });

  app.get('/api/services/:service/logs', (req, res) => {
    const serviceName = req.params.service;
    const service = project.services.get(serviceName);
    if (!service) {
      log.error('GET /api/services/:service/logs - 404: No such service');
      return res.status(404).send();
    }
    const logs: string[] | undefined = service.logs('in-memory')?.get('start') as string[] | undefined;
    return res.json(logs ?? []);
  });

  app.get('/api/aws/account', async (req, res) => {
    try {
      const account = await aws.iam.getCurrentUser();
      res.json({ connected: true, account });
    } catch {
      res.json({ connected: false });
    }
  });

  app.get('/api/environments', async (req, res) => {
    if (!options.config) {
      return res.status(401);
    }
    const state = new State(options.config.state.table, options.config.defaultRegion);
    const envs = await state.listEnvironments();
    return res.json(envs);
  });

  app.get('/api/state/:env', async (req, res) => {
    if (!options.config) {
      return res.status(401);
    }
    const state = new State(options.config.state.table, options.config.defaultRegion);
    const services = await state.listServices(req.params.env);
    return res.json(services);
  });

  app.get('/api/services/:service/environment/:env', async (req, res) => {
    const serviceName = req.params.service;
    const env = req.params.env;
    const loader = new EnvironmentLoader(project, process.env.AWS_REGION ?? 'us-east-1');
    const vars: Array<ILoadedEnvironmentVariable> = await loader.loadAll({
      env: env,
      service: serviceName,
      inject: false,
      shouldInterpolate: true,
      ssmMode: SSMResolverMode.WARN,
      overwrite: false,
    });
    return res.json(vars);
  });

  const http = createServer(app);
  return new Promise<Server>((resolve) => {
    http.listen(port, () => {
      resolve(http);
    });
  });
};
