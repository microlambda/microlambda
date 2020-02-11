import { IGraphElement, LernaNode } from './lerna-node';
import { createWriteStream } from "fs";
import { spawn } from "child_process";
import { LernaGraph } from './lerna-graph';
import { createLogDirectory, getLogsPath } from '../utils/logs';

enum ServiceStatus {
  STARTING,
  RUNNING,
  STOPPING,
  STOPPED,
  CRASHED,
  RESTARTING,
}

export class Service extends LernaNode {
  private status: ServiceStatus;
  private readonly node: LernaNode;
  private readonly port: number;

  constructor(graph: LernaGraph, node: IGraphElement) {
    super(graph, node);
    this.status = ServiceStatus.STOPPED;
    this.port = graph.getPort(node.name);
  }

  public getStatus() { return this.status };
  public getNode() { return this.node };

  public start() {
    this.status = ServiceStatus.STARTING;
    createLogDirectory(this.graph.getProjectRoot());
    console.log(`Starting ${this.node.getName()} on localhost:${this.port}`);
    console.log('Location:', this.node.getLocation());
    console.log('Env:', process.env);
    const logsStream = createWriteStream(getLogsPath(this.graph.getProjectRoot(), this.node.getName()));
    const spawnProcess = spawn('npm', ['run', 'start', '--port', `${this.port}`], {
      cwd: this.getNode().getLocation(),
      env: process.env,
      stdio: 'inherit',
    });
    return new Promise<void>(((resolve, reject) => {
      spawnProcess.stdout.on('data', (data) => {
        logsStream.write(data);
        if (data.includes('listening on')) {
          this.status = ServiceStatus.RUNNING;
          resolve();
        }
      });
      spawnProcess.stderr.on('data', (data) => {
        logsStream.write(data);
      });
      spawnProcess.on('close', (code) => {
        console.log(`Service ${this.getNode().getName()} exited with code ${code}`);
        this.status = ServiceStatus.CRASHED;
        reject();
      });
      spawnProcess.on('error', (err) => {
        console.log(err);
        this.status = ServiceStatus.CRASHED;
        reject(err);
      })
    }));
  }
}
