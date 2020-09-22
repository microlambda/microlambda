import { ServiceStatus } from './service.status.enum';
import { CompilationStatus } from './compilation.status.enum';

export interface INode {
  name: string;
  version: string;
  port: number;
  enabled: boolean;
  compiled: CompilationStatus;
  status: ServiceStatus;
}
