#!/usr/bin/env node
import { getLernaGraph } from './lerna';
import {join, parse, dirname, resolve } from 'path';
import { existsSync } from 'fs';
import { LernaNode } from './lerna/lerna-node';
import { exec, spawn } from 'child_process';
import { log } from './utils/logger';

const isService = (location: string): boolean => {
  return existsSync(join(location, 'serverless.yml')) || existsSync(join(location, 'serverless.yaml'));
};

const stopService = (service: LernaNode) => {

};

const getProjectRoot = (): string => {
  try {
    const fileSystemRoot = parse(process.cwd()).root;
    const checkDepth = (): string => {
      if (process.cwd() === fileSystemRoot) {
        throw Error('Filesystem root reached');
      }
      log('Check path', join(process.cwd(), 'lerna.json'));
      const hasLerna = () => existsSync( join(process.cwd(), 'lerna.json'));
      log('Exists', hasLerna());
      if (hasLerna()) {
        return process.cwd();
      }
      process.chdir('..');
      return checkDepth();
    };
    const current = process.cwd();
    const projectRoot = checkDepth();
    process.chdir(current);
    return projectRoot;
  } catch (e) {
    console.error('Cannot find project root. Make sure it is a valid lerna project.');
    process.exit(1);
  }
};

const createLogDirectory = () => {
  // TODO
};

const startService = (service: LernaNode, port: number) => {
  const process = spawn(`npm run start --port ${port}`, {
    cwd: service.getLocation(),
  });
  process.stdout.on('data', (data) => {
    // TODO: write in logs

    // TODO: watch for serverless started and update status
  });
  process.stderr.on('data', (data) => {
    // TODO: write in logs

    // TODO: update status
  });
};
const projectRoot = getProjectRoot();
const graph = getLernaGraph(projectRoot);
const services = graph.getNodes().filter(node => isService(node.getLocation()));
console.log(services);
