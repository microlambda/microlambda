#!/usr/bin/env node
import { getLernaGraph } from './lerna';
import { join, parse, dirname, resolve } from 'path';
import { existsSync } from 'fs';
import { LernaNode } from './lerna/lerna-node';
import { spawn } from 'child_process';
import { log } from './utils/logger';
import { options } from 'yargs';
import { writeFileSync } from 'fs';
const isPortReachable = require('is-port-reachable');

const isService = (location: string): boolean => {
  return existsSync(join(location, 'serverless.yml')) || existsSync(join(location, 'serverless.yaml'));
};

const stopService = (service: LernaNode) => {

};

const getProjectRoot = (path?: string): string => {
  try {
    console.log(path);
    if (!path) {
      path = process.cwd();
    }
    const fileSystemRoot = parse(path).root;
    console.log(fileSystemRoot);

    const checkDepth = (): string => {
      if (path === fileSystemRoot) {
        throw Error('Filesystem root reached');
      }

      console.log('Check path', join(path, 'lerna.json'));
      const hasLerna = () => existsSync(join(path, 'lerna.json'));
      log('Exists', hasLerna());
      if (hasLerna()) {
        return path;
      }
      process.chdir('..');
      return checkDepth();
    };
    const current = path;
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
  console.log('location', service.getLocation());
  console.log('env', process.env);

  const spawnProcess = spawn('npm', ['run', 'start', '--port', `${port}`], {
    cwd: service.getLocation(),
    env: process.env
  });
  spawnProcess.stdout.on('data', (data) => {
    console.log(data);

    writeFileSync('./.logs', data);

    // TODO: watch for serverless started and update status
  });
  spawnProcess.stderr.on('data', (data) => {
    console.log(data);

    writeFileSync('./.errors', data);

    // TODO: update status
  });

  spawnProcess.on('close', (code) => {
    console.log(`child spawnProcess exited with code ${code}`);
  });

  spawnProcess.on('error', (err) => {
    console.log(err);
  })
};

// const portAvailability = (services: LernaNode[]) => {
//   let port = 3000;
//   services.map(async () => {
//     console.log(await isPortReachable(port, { host: 'localhost' }));

//     if (await isPortReachable(port, { host: 'localhost' }) {
//       port = port++;
//     }
//   });
//   return ;

// }

const argv = options({
  env: {
    alias: 'e',
    choices: ['dev', 'prod'] as const,
    default: 'dev',
    demandOption: true,
    description: 'app environment'
  },
  port: {
    alias: 'p',
    type: 'number',
    default: 80,
    description: 'port'
  },
  path: {
    alias: 'path',
    type: 'string',
    default: process.cwd(),
    description: 'path'
  }
})
  .command(['start'], 'Starting up sls-tool!', {}, (argv) => {
    console.log('starting up the app')

    // console.log(await isPortReachable(3002, { host: 'localhost' }));

    const projectRoot = getProjectRoot(argv.path as string);
    console.log('project root', projectRoot);

    const graph = getLernaGraph(projectRoot);
    const services = graph.getNodes().filter(node => isService(node.getLocation()));

    console.log('services', services);
    // let port = portAvailability(services);


    let port = 3001;
    services.map((service) => {
      startService(service, port++);
    })
  })
  .check(data => !isNaN(data.port))
  .help()
  .wrap(80)
  .argv;

