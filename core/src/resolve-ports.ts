import { ConfigReader } from '@microlambda/config';
import { EventsLog } from '@microlambda/logger';
import { Workspace } from '@microlambda/runner-core';

export interface IServicePortsConfig {
  lambda: number;
  http: number;
  websocket: number;
}

export type PortMap = {
  [service: string]: IServicePortsConfig;
};

/**
 * Resolve ports for a given array  of services
 * If a config file is found and the service port is explicitly assigned in it, use it
 * Otherwise start from default port 3001 and increment it.
 * @param services
 * @param config
 * @param logger
 * @param defaultPorts
 */
export const resolvePorts = async (
  services: Workspace[],
  configReader: ConfigReader,
  logger?: EventsLog,
  defaultPorts = { lambda: 2001, http: 3001, websocket: 6001 },
): Promise<PortMap> => {
  const result: PortMap = {};
  await Promise.all(services.map(async (service) => {
    const config = await configReader.loadPackageConfig(service.name, service.root);
    logger?.scope('port').debug('Resolving port from config', config);
    const fromConfig: Partial<IServicePortsConfig> = {};
    if (config.ports && typeof config.ports === 'number') {
      fromConfig.http = config.ports;
    } else {
      if (config.ports?.http) {
        fromConfig.http = config.ports;
      }
      if (config.ports?.lambda) {
        fromConfig.lambda = config.ports;
      }
      if (config.ports?.websocket) {
        fromConfig.websocket = config.ports;
      }
    }
    result[service.name] = {
      ...defaultPorts,
      ...fromConfig,
    };
    defaultPorts.http++;
    defaultPorts.lambda++;
    defaultPorts.websocket++;
  }));
  logger?.scope('port').debug('Ports resolved', result);
  return result;
};
