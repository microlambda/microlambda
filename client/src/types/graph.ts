import type { INodeSummary } from '@microlambda/types';

export interface IGraph {
  packages: INodeSummary[];
  services: INodeSummary[];
}
