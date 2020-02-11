import { IGraphElement, LernaNode } from './lerna-node';
import { execSync, spawn } from "child_process";
import { LernaGraph } from './lerna-graph';

enum PackageStatus {
  NOT_COMPILED,
  COMPILING,
  COMPILED,
  ERROR_COMPILING,
}

export class Package extends LernaNode {
  private status: PackageStatus;

  constructor(graph: LernaGraph, node: IGraphElement) {
    super(graph, node);
    this.status = PackageStatus.NOT_COMPILED;
  }

  public getStatus() { return this.status };

  public async compile(): Promise<void> {
    const tsVersion = execSync('npx tsc --version').toString();
    this.status = PackageStatus.COMPILING;
    console.info(`Compiling package ${this.name} with typescript ${tsVersion}`);
    const spawnProcess = spawn('npx', ['tsc'], {
      cwd: this.location,
      env: process.env,
      stdio: 'inherit',
    });
    return new Promise<void>((resolve, reject) => {
      spawnProcess.stderr.on('data', (data) => {
        console.error(data);
      });
      spawnProcess.on('close', (code) => {
        if (code === 0) {
          this.status = PackageStatus.COMPILED;
          resolve();
        } else {
          this.status = PackageStatus.ERROR_COMPILING;
          reject();
        }
      });
      spawnProcess.on('error', (err) => {
        console.log(err);
        this.status = PackageStatus.ERROR_COMPILING;
      })
    });
  }
}
