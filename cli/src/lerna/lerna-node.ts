import { LernaGraph } from './lerna-graph';

export interface IGraphElement {
  name: string;
  version: string;
  private: boolean;
  location: string;
  dependencies: IGraphElement[];
}

export class LernaNode {
  private readonly graph: LernaGraph;
  private readonly name: string;
  private readonly version: string;
  private readonly private: boolean;
  private readonly location: string;
  private readonly dependencies: LernaNode[];

  constructor(graph: LernaGraph, node: IGraphElement) {
    this.graph = graph;
    this.name = node.name;
    this.version = node.version;
    this.private = node.private;
    this.location = node.location;
    this.dependencies = node.dependencies.map(d => new LernaNode(graph, d));
  };

  public getName(): string { return this.name }
  public getLocation(): string { return this.location }

  public getDependencies(): LernaNode[] {

    const hasNext = (previous: LernaNode): boolean  => previous.dependencies.length > 0;

    const concatNext = (deps: Set<string>, currentNode: LernaNode, depth = 0): void => {
      if (hasNext(currentNode)) {
        for (const node of currentNode.dependencies) {
          if (!deps.has(node.name)) {
            deps.add(node.name);
          }
          concatNext(deps, node, depth + 1);
        }
      }
    };

    const dependencies: Set<string> = new Set();
    concatNext(dependencies, this);
    return Array.from(dependencies).map(name => this.graph.get(name));
  }

  public getDependent(): LernaNode[] {
    return this.graph.getNodes().filter(n => n.getDependencies().includes(this));
  }
}
