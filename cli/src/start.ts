#!/usr/bin/env node
import { getLernaGraph } from './lerna';
import { options } from 'yargs';
import { getProjectRoot } from './utils/get-project-root';
import { loadConfig } from './config/load-config';
import { showOff } from './utils/ascii';

const DEFAULT_PORT = 3001;

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
    showOff();
    console.log('Starting up the app');
    const projectRoot = getProjectRoot(argv.path as string);

    console.log('Loading config');
    const config = loadConfig();
    console.debug(config);

    console.log('Parsing lerna dependency graph', projectRoot);
    const defaultPort = argv.port != null ? parseInt(argv.port as string, 10) : DEFAULT_PORT;
    const graph = getLernaGraph(projectRoot, config, defaultPort);

    const services = graph.getServices();

    console.log(`Found ${services.length} services`);
    console.log('Starting services');
    services.forEach(s => s.start());
  })
  .check(data => !isNaN(data.port))
  .help()
  .wrap(80)
  .argv;
