import { IGraphElement, LernaNode } from './';
import { LernaGraph } from './';

export class Package extends LernaNode {
  constructor(graph: LernaGraph, node: IGraphElement) {
    super(graph, node);
  }

  public getStatus() { return this.compilationStatus };
}
