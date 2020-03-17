import { LernaGraph } from '../../src/lerna';
import { stub } from 'sinon';
import fs from 'fs';
import { graph1 } from '../factories/graph-1';
import { config1 } from '../factories/config-1';
import { IConfig } from '../../src/config/config';

export const generateGraph = (config: IConfig = config1, defaultPort?: number): LernaGraph => {
  const existsSync = stub(fs, 'existsSync');
  existsSync.withArgs('path/to/service/serverless.yml').returns(true);
  existsSync.withArgs('path/to/package/serverless.yml').returns(false);
  const graph = new LernaGraph(graph1, __dirname, config, defaultPort);
  graph.getProjectRoot();
  existsSync.restore();
  return graph;
};
