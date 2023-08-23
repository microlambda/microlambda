import { ServiceStatus, TranspilingStatus, TypeCheckStatus } from '..';

export interface ICommandMetric {
  finishedAt: string;
  took: number;
  fromCache: boolean;
}

export interface ICommandMetrics {
  transpile?: ICommandMetric;
  typecheck?: ICommandMetric;
  start?: ICommandMetric;
}

export interface INodeSummary {
  name: string;
  version: string;
  type: 'service' | 'package';
  port: number | null;
  enabled: boolean;
  transpiled: TranspilingStatus;
  typeChecked: TypeCheckStatus;
  status: ServiceStatus | null;
  hasTargets: {
    build: boolean;
    start: boolean;
  }
  children: string[];
  metrics: ICommandMetrics;
}
