import { LernaGraph } from './lerna-graph';
import { existsSync } from 'fs';
import { join } from 'path';
import { Package, Service } from './';
import { CompilationStatus } from './enums/compilation.status';
import { execSync, spawn } from 'child_process';
import { log } from '../utils/logger';

export interface IGraphElement {
  name: string;
  version: string;
  private: boolean;
  location: string;
  dependencies: IGraphElement[];
}

export abstract class LernaNode {
  protected readonly name: string;
  protected readonly location: string;
  protected readonly graph: LernaGraph;
  protected readonly dependencies: LernaNode[];

  private readonly version: string;
  private readonly private: boolean;

  protected compilationStatus: CompilationStatus;

  protected constructor(graph: LernaGraph, node: IGraphElement) {
    this.graph = graph;
    this.name = node.name;
    this.version = node.version;
    this.private = node.private;
    this.location = node.location;
    this.compilationStatus = CompilationStatus.NOT_COMPILED;
    this.dependencies = node.dependencies.map(d => this.isService() ? new Service(graph, d) : new Package(graph, d));
  };

  public isService(): boolean {
    return existsSync(join(this.location, 'serverless.yml')) || existsSync(join(this.location, 'serverless.yaml'));
  };

  public isRoot(): boolean {
    return this.getDependent().length === 0;
  }

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

  /**
   * Recursively compiles this package and all its dependencies
   */
  public async compile(_alreadyCompiling?: Set<string>): Promise<void> {
    log.debug('Compiling', this.name);
    const alreadyCompiling= !_alreadyCompiling ? new Set<string>() : _alreadyCompiling;
    if (!alreadyCompiling.has(this.name)) {
      alreadyCompiling.add(this.name);
      log.debug('Already compiling', alreadyCompiling);
      for (const dep of this.dependencies) {
        // Proceed sequentially has leaf packages have to be compiled first
        await dep.compile(alreadyCompiling);
      }
      await this._compile();
    }
  }

  protected async _compile(): Promise<void> {
    const tsVersion = execSync('npx tsc --version').toString().match(/[0-9]\.[0-9]\.[0-9]/)[0];
    this.compilationStatus = CompilationStatus.COMPILING;
    log.info(`Compiling package ${this.name} with typescript ${tsVersion}`);
    const spawnProcess = spawn('npx', ['tsc'], {
      cwd: this.location,
      env: process.env,
    });
    return new Promise<void>((resolve, reject) => {
      spawnProcess.stderr.on('data', (data) => {
        log.error(data);
      });
      spawnProcess.on('close', (code) => {
        if (code === 0) {
          this.compilationStatus = CompilationStatus.COMPILED;
          log.info(`Package compiled ${this.name}`);
          return resolve();
        } else {
          this.compilationStatus = CompilationStatus.ERROR_COMPILING;
          log.info(`Error compiling ${this.name}`);
          return reject();
        }
      });
      spawnProcess.on('error', (err) => {
        log.error(err);
        this.compilationStatus = CompilationStatus.ERROR_COMPILING;
        log.info(`Error compiling ${this.name}`, err);
        return reject();
      })
    });
  }
}
