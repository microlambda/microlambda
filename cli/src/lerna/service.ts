import { IGraphElement, LernaGraph, LernaNode } from './';
import { createWriteStream, existsSync } from 'fs';
import { ChildProcess, spawn } from 'child_process';
import { createLogFile, getLogsPath } from '../utils/logs';
import { log } from '../utils/logger';
import { ServiceStatus } from './enums/service.status';
import { Observable } from 'rxjs';
import chalk from 'chalk';

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

  public async stop(): Promise<void> {
    if (this.status === ServiceStatus.RUNNING) {
      log.info(`Stopping service ${this.name}`);
      this.process.kill();
      return new Promise(((resolve) => {
        this.process.on('close', (code) => {
          if (code === 0) {
            log.info(`Service ${this.name} exited with code ${code}`);
            this.status = ServiceStatus.STOPPED;
          } else {
            log.error(`Service ${this.name} exited with code ${code}`);
            this.status = ServiceStatus.CRASHED;
          }
          return resolve();
        });
      }));
    }
    log.warn('Requested to stop a service that is not running', this.name);

  }

  public start(): Observable<void> {
    return new Observable<void>((observer) => {
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
      spawnProcess.stdout.on('data', (data) => {
        logsStream.write(data);
        if (data.includes('listening on')) {
          log.info(`${chalk.bold.bgGreenBright('success')}: ${this.name} listening localhost:${this.port}`);
          this.status = ServiceStatus.RUNNING;
          observer.complete();
        }
      });
      spawnProcess.stderr.on('data', (data) => {
        log.error(data);
        logsStream.write(data);
      });
      spawnProcess.on('close', (code) => {
        if (code !== 0) {
          log.error(`Service ${this.name} exited with code ${code}`);
          this.status = ServiceStatus.CRASHED;
          observer.error();
        }
      });
      spawnProcess.on('error', (err) => {
        log.error(`Could not start service ${this.name}`, err);
        this.status = ServiceStatus.CRASHED;
        observer.error(err);
      })
    });
  }
}
