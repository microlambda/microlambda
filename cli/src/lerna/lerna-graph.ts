import { IGraphElement, LernaNode } from './lerna-node';

export class LernaGraph {
  private readonly nodes: LernaNode[];
  constructor(nodes: IGraphElement[]) { this.nodes = nodes.map(n => new LernaNode(this, n)) };

  public getNodes(): LernaNode[] { return this.nodes }

  public get(name: string): LernaNode {
    return this.nodes.find(n => n.getName() === name);
  }
}
