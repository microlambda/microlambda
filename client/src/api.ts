/**
 * API layer module
 */

import { env } from './env/dev.env';
import type { IEventLog, LogLevel } from '@microlambda/types';
import type { IGraph } from './types/graph';
import type { ILogsResponse } from './types/logs-response';

export async function fetchGraph(): Promise<IGraph> {
  const response = await fetch(`${env.apiUrl}/api/graph`);
  return response.json();
}

async function _doActionOnService(
  service: string,
  action: string,
): Promise<void> {
  await fetch(env.apiUrl + '/api/services/' + encodeURIComponent(service), {
    method: 'put',
    body: JSON.stringify({
      action,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

async function _doActionOnGraph(action: string): Promise<void> {
  await fetch(env.apiUrl + '/api/graph', {
    method: 'put',
    body: JSON.stringify({
      action,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export async function startService(service: string): Promise<void> {
  return _doActionOnService(service, 'start');
}

export async function restartService(service: string): Promise<void> {
  return _doActionOnService(service, 'restart');
}

export async function stopService(service: string): Promise<void> {
  return _doActionOnService(service, 'stop');
}

export async function startAll(): Promise<void> {
  return _doActionOnGraph('startAll');
}

export async function restartAll(): Promise<void> {
  return _doActionOnGraph('restartAll');
}

export async function stopAll(): Promise<void> {
  return _doActionOnGraph('stopAll');
}

export async function fetchServiceLogs(
  service: string,
  slice: [number, number?],
): Promise<ILogsResponse> {
  return (
    await fetch(
      `${env.apiUrl}/api/services/${encodeURIComponent(
        service,
      )}/logs?slice=${slice.join(',')}`,
    )
  ).json();
}

export async function fetchCompilationLogs(
  node: string,
  slice: [number, number?],
): Promise<ILogsResponse> {
  return (
    await fetch(
      `${env.apiUrl}/api/nodes/${encodeURIComponent(
        node,
      )}/tsc/logs?slice=${slice.join(',')}`,
    )
  ).json();
}

export async function fetchEventLogs(
  slice: [number, number?],
  level: LogLevel = 'info',
): Promise<ILogsResponse<IEventLog>> {
  return (
    await fetch(
      `${env.apiUrl}/api/logs?slice=${slice.join(',')}&level=` + level,
    )
  ).json();
}
