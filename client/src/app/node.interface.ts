import { ServiceStatus } from './service.status.enum';
import { TranspilingStatus, TypeCheckStatus } from './compilation.status.enum';

export interface INode {
  name: string;
  version: string;
  port: number;
  enabled: boolean;
  transpiled: TranspilingStatus;
  typeChecked: TypeCheckStatus;
  lastTypeCheck: string;
  status: ServiceStatus;
}
