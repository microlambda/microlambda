import { IConfig } from './config/config';
import { Logger } from './logger';
import { Workspace } from '@yarnpkg/core';
import { getName } from './yarn/project';

type PortMap = { [key: string]: number };

/**
 * Resolve ports for a given array  of services
 * If a config file is found and the service port is explicitly assigned in it, use it
 * Otherwise start from default port 3001 and increment it.
 * @param services
 * @param config
 * @param logger
 * @param defaultPort
 */
export const resolvePorts = (
  services: Workspace[],
  config: IConfig,
  logger: Logger,
  defaultPort = 3001,
): PortMap => {
  logger.log('port').debug('Resolving port from config', config);
  const result: PortMap = {};
  services.forEach((service) => {
    const name = getName(service);
    const inConfig = config.ports[name] != null;
    const port = inConfig ? config.ports[name] : defaultPort;
    if (!inConfig) {
      defaultPort++;
    }
    result[name] = port;
  });
  logger.log('port').debug('Ports resolved', result);
  return result;
};
