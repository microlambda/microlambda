import { IGraphElement, LernaGraph, LernaNode } from './';
import { createWriteStream, WriteStream } from 'fs';
import { ChildProcess, spawn } from 'child_process';
import { createLogFile, getLogsPath } from '../utils/logs';
import { log } from '../utils/logger';
import { ServiceStatus } from './enums/service.status';
import { Observable } from 'rxjs';
import chalk from 'chalk';
import { concatMap, tap } from 'rxjs/operators';
import { getBinary } from '../utils/external-binaries';
import { actions } from '../ui';

export class Service extends LernaNode {
  private status: ServiceStatus;
  private readonly port: number;
  private process: ChildProcess;
  private logStream: WriteStream;

  constructor(graph: LernaGraph, node: IGraphElement, nodes: Set<LernaNode>, elements: IGraphElement[]) {
    super(graph, node, nodes, elements);
    this.status = ServiceStatus.STOPPED;
    this.port = graph.getPort(node.name);
  }

  public getStatus(): ServiceStatus {
    return this.status;
  }

  public stop(): Observable<Service> {
    return new Observable<Service>((observer) => {
      log('service').debug('Requested to stop', this.name, 'which status is', this.status);
      switch (this.status) {
        case ServiceStatus.RUNNING:
        case ServiceStatus.STARTING:
          this.process.kill();
          break;
        case ServiceStatus.STOPPING:
          log('service').warn('Requested to stop a service that already stopping', this.name);
          break;
        case ServiceStatus.CRASHED:
        case ServiceStatus.STOPPED:
          log('service').warn('Requested to stop a service that is not running', this.name);
          observer.next(this);
          return observer.complete();
      }
      this.process.on('close', (code) => {
        if (code === 0) {
          log('service').info(`Service ${this.name} exited with code ${code}`);
          this._updateStatus(ServiceStatus.STOPPED);
        } else {
          log('service').error(`Service ${this.name} exited with code ${code}`);
          this._updateStatus(ServiceStatus.CRASHED);
        }
        // this.process.removeAllListeners('close');
        this.process = null;
        observer.next(this);
        return observer.complete();
      });
    });
  }

  public start(): Observable<Service> {
    return new Observable<Service>((observer) => {
      log('service').debug('Requested to start', this.name, 'which status is', this.status);
      switch (this.status) {
        case ServiceStatus.CRASHED:
        case ServiceStatus.STOPPED:
          this._startProcess();
          this._watchStarted().subscribe(
            (next) => observer.next(next),
            (err) => observer.error(err),
            () => observer.complete(),
          );
          break;
        case ServiceStatus.STOPPING:
          log('service').warn('Service is already stopping', this.name);
          this.stop()
            .pipe(
              tap(() => this._startProcess()),
              concatMap(() => this._watchStarted()),
            )
            .subscribe(
              (next) => observer.next(next),
              (err) => observer.error(err),
              () => observer.complete(),
            );
          break;
        case ServiceStatus.STARTING:
          log('service').warn('Service is already starting', this.name);
          this._watchStarted().subscribe(
            (next) => observer.next(next),
            (err) => observer.error(err),
            () => observer.complete(),
          );
          break;
        case ServiceStatus.RUNNING:
          log('service').warn('Service is already running', this.name);
          observer.next(this);
          return observer.complete();
      }
    });
  }

  private _startProcess(): void {
    this._updateStatus(ServiceStatus.STARTING);
    createLogFile(this.graph.getProjectRoot(), this.name);
    log('service').info(`Starting ${this.name} on localhost:${this.port}`);
    log('service').debug('Location:', this.location);
    log('service').debug('Env:', process.env.ENV);
    this.logStream = createWriteStream(getLogsPath(this.graph.getProjectRoot(), this.name));
    this.process = spawn(
      getBinary('sls', this.graph.getProjectRoot(), this),
      ['offline', 'start', '--port', this.port.toString(), '--region', process.env.AWS_REGION],
      {
        cwd: this.location,
        env: process.env,
      },
    );
    this.process.stderr.on('data', (data) => {
      log('service').error(`${chalk.bold(this.name)}: ${data}`);
      this.logStream.write(data);
    });
  }

  private _watchStarted(): Observable<Service> {
    return new Observable<Service>((started) => {
      this.process.stdout.on('data', (data) => {
        this.logStream.write(data);
        if (data.includes('listening on')) {
          log('service').info(`${chalk.bold.bgGreenBright('success')}: ${this.name} listening localhost:${this.port}`);
          this._updateStatus(ServiceStatus.RUNNING);
          started.next(this);
          return started.complete();
        }
      });
      this.process.on('close', (code) => {
        if (code !== 0) {
          log('service').error(`Service ${this.name} exited with code ${code}`);
          this._updateStatus(ServiceStatus.CRASHED);
          // this.process.removeAllListeners('close');
          return started.error();
        }
      });
      this.process.on('error', (err) => {
        log('service').error(`Could not start service ${this.name}`, err);
        this._updateStatus(ServiceStatus.CRASHED);
        return started.error(err);
      });
    });
  }

  private _updateStatus(status: ServiceStatus): void {
    this.status = status;
    this._ipc.graphUpdated();
    actions.updateServiceStatus(this);
  }
}
