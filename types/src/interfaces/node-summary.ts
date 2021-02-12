import { ServiceStatus, TranspilingStatus, TypeCheckStatus } from '..';

export interface INodeSummary {
  name: string;
  version: string;
  type: 'service' | 'package';
  port: number | null;
  enabled: boolean;
  transpiled: TranspilingStatus;
  typeChecked: TypeCheckStatus;
  status: ServiceStatus | null;
  metrics: {
    lastTypeCheck: string | null;
    typeCheckTook: number | null;
    typeCheckFromCache: boolean;
    lastTranspiled: string | null;
    transpileTook: number | null;
    lastStarted: string | null;
    startedTook: number | null;
  };
}
