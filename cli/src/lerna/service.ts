import { IGraphElement, LernaNode } from './';
import { createWriteStream } from "fs";
import { ChildProcess, spawn } from 'child_process';
import { LernaGraph } from './';
import { createLogFile, getLogsPath } from '../utils/logs';
import { log } from '../utils/logger';
import { ServiceStatus } from './enums/service.status';

export class Service extends LernaNode {
  private status: ServiceStatus;
  private readonly port: number;
  private process: ChildProcess;

  constructor(graph: LernaGraph, node: IGraphElement) {
    super(graph, node);
    this.status = ServiceStatus.STOPPED;
    this.port = graph.getPort(node.name);
  }

  public getStatus() { return this.status };

  public stop() {
    log.warn(`Stopping service ${this.name}`);
    this.process.kill();
  }

  public start() {
    this.status = ServiceStatus.STARTING;
    createLogFile(this.graph.getProjectRoot(), this.name);
    log.info(`Starting ${this.name} on localhost:${this.port}`);
    log.debug('Location:', this.location);
    log.debug('Env:', process.env.ENV);
    const logsStream = createWriteStream(getLogsPath(this.graph.getProjectRoot(), this.name));
    const spawnProcess = spawn('npx', ['sls', 'offline', 'start', '--port', this.port.toString()], {
      cwd: this.location,
      env: process.env,
    });
    this.process = spawnProcess;
    return new Promise<void>(((resolve, reject) => {
      spawnProcess.stdout.on('data', (data) => {
        logsStream.write(data);
        if (data.includes('listening on')) {
          this.status = ServiceStatus.RUNNING;
          resolve();
        }
      });
      spawnProcess.stderr.on('data', (data) => {
        log.error(data);
        logsStream.write(data);
      });
      spawnProcess.on('close', (code) => {
        log.error(`Service ${this.name} exited with code ${code}`);
        this.status = ServiceStatus.CRASHED;
        reject();
      });
      spawnProcess.on('error', (err) => {
        log.error(err);
        this.status = ServiceStatus.CRASHED;
        reject(err);
      })
    }));
  }
}
