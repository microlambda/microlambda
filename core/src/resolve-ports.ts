import { IConfig } from './config/config';
import { Logger } from './logger';
import { Workspace } from '@yarnpkg/core';
import { getName } from './yarn/project';
import { Socket } from 'net';

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
export const resolvePorts = (
  services: Workspace[],
  config: IConfig,
  logger?: Logger,
  defaultPorts = { lambda: 2001, http: 3001, websocket: 6001 },
): PortMap => {
  logger?.log('port').debug('Resolving port from config', config);
  const result: PortMap = {};
  services.forEach((service) => {
    const name = getName(service);
    const inConfig = config.ports[name] != null;
    let fromConfig: Partial<IServicePortsConfig> = {};
    if (inConfig) {
      const ports = config.ports[name];
      fromConfig = typeof ports === 'number' ? { http: ports } : ports;
    }
    result[name] = {
      ...defaultPorts,
      ...fromConfig,
    };
    defaultPorts.http++;
    defaultPorts.lambda++;
    defaultPorts.websocket++;
  });
  logger?.log('port').debug('Ports resolved', result);
  return result;
};

export const isPortAvailable = async (port: number, host = '127.0.0.1', timeout = 400): Promise<boolean> => {
  return new Promise((resolve) => {
    const socket = new Socket();
    let status: 'open' | 'closed';
    socket.on('connect', () => {
      status = 'open';
      socket.destroy();
    });
    socket.setTimeout(timeout);
    socket.on('timeout', () => {
      status = 'closed';
      socket.destroy();
    });
    socket.on('error', () => {
      status = 'closed';
    });
    socket.on('close', () => {
      resolve(status === 'open');
    });
    socket.connect(port, host);
  });
};
