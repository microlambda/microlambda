/**
 * API layer module
 */

import { env } from "./env/dev.env";
import type {
  IEventLog,
  INodeSummary,
  ServiceLogs,
  LogLevel,
  SchedulerStatus,
} from "@microlambda/types";
import { logger } from "./logger";

const log = logger.scope("(api)");

export async function fetchGraph(): Promise<INodeSummary[]> {
  const response = await fetch(`${env.apiUrl}/api/graph`);
  const updatedGraph = await response.json();
  log.info("Graph fetched", updatedGraph.length);
  return updatedGraph;
}

async function _doActionOnService(
  service: string,
  action: string
): Promise<void> {
  await fetch(env.apiUrl + "/api/services/" + encodeURIComponent(service), {
    method: "put",
    body: JSON.stringify({
      action,
    }),
    headers: {
      "Content-Type": "application/json",
    },
  });
}

async function _doActionOnGraph(action: string): Promise<void> {
  await fetch(env.apiUrl + "/api/graph", {
    method: "put",
    body: JSON.stringify({
      action,
    }),
    headers: {
      "Content-Type": "application/json",
    },
  });
}

export async function startService(service: string): Promise<void> {
  return _doActionOnService(service, "start");
}

export async function restartService(service: string): Promise<void> {
  return _doActionOnService(service, "restart");
}

export async function stopService(service: string): Promise<void> {
  return _doActionOnService(service, "stop");
}

export async function startAll(): Promise<void> {
  return _doActionOnGraph("startAll");
}

export async function restartAll(): Promise<void> {
  return _doActionOnGraph("restartAll");
}

export async function stopAll(): Promise<void> {
  return _doActionOnGraph("stopAll");
}

export async function fetchServiceLogs(service: string): Promise<ServiceLogs> {
  const response = await fetch(
    `${env.apiUrl}/api/services/${encodeURIComponent(service)}/logs`
  );
  const serviceLogs = await response.json();
  log.info("Service Logs updated", service, serviceLogs.length);
  return serviceLogs;
}

export async function fetchCompilationLogs(node: string): Promise<string[]> {
  const response = await fetch(
    `${env.apiUrl}/api/nodes/${encodeURIComponent(node)}/tsc/logs`
  );
  const compilationLogs = await response.json();
  log.info("Build Logs updated", node, compilationLogs.length);
  return compilationLogs;
}

export async function fetchEventLogs(
  level: LogLevel = "info"
): Promise<IEventLog[]> {
  const response = await fetch(`${env.apiUrl}/api/logs?level=` + level);
  const compilationLogs = await response.json();
  log.info("Events Log updated", level, compilationLogs.length);
  return compilationLogs;
}

export async function fetchSchedulerStatus(): Promise<SchedulerStatus> {
  const response = await fetch(`${env.apiUrl}/api/scheduler/status`);
  const status = await response.json();
  log.info("Scheduler status", status);
  return status.status;
}
