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
 * @param configReader
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
  await Promise.all(
    services
      .filter((s) => s.hasCommand('start'))
      .map(async (service) => {
        const config = await configReader.loadPackageConfig(service.name, service.root);
        logger?.scope('port').debug('Resolving port from config', config);
        const fromConfig: Partial<IServicePortsConfig> = {};
        const ports = config.ports;
        if (ports) {
          if (typeof ports === 'number') {
            fromConfig.http = ports;
          } else {
            if (ports?.http) {
              fromConfig.http = ports.http;
            }
            if (ports?.lambda) {
              fromConfig.lambda = ports.lambda;
            }
            if (ports?.websocket) {
              fromConfig.websocket = ports.websocket;
            }
          }
        }
        result[service.name] = {
          ...defaultPorts,
          ...fromConfig,
        };
        defaultPorts.http++;
        defaultPorts.lambda++;
        defaultPorts.websocket++;
      }),
  );
  logger?.scope('port').debug('Ports resolved', result);
  return result;
};
