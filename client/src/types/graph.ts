import { INodeSummary } from '@microlambda/types';

export interface IGraph {
  packages: INodeSummary[];
  services: INodeSummary[];
}
