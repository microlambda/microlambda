import { IGraphElement, LernaNode } from '../lerna/lerna-node';
import { IConfig } from '../config/config';
import { log } from './logger';

/**
 * Resolve ports for a given array  of services
 * If a config file is found and the service port is explicitly assigned in it, use it
 * Otherwise start from default port 3001 and increment it.
 * @param services
 * @param config
 * @param defaultPort
 */
export const resolvePorts = (services: IGraphElement[], config: IConfig, defaultPort = 3001) => {
  log.debug('Resolving port from config', config.ports);
  const result: {[key: string]: number} = {};
  services.forEach((service) => {
    const name = service.name;
    const inConfig = config.ports[name] != null;
    const port = inConfig ? config.ports[name] : defaultPort;
    if (!inConfig) {
      defaultPort++;
    }
    result[service.name] = port;
  });
  log.debug('Ports resolved', result);
  return result;
};
