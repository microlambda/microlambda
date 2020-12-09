import { IGraphElement, LernaGraph, LernaNode } from './';
import { createWriteStream, WriteStream } from 'fs';
import { ChildProcess, spawn } from 'child_process';
import { createLogFile, getLogsPath } from '../utils/logs';
import { ServiceStatus } from './enums/service.status';
import { Observable } from 'rxjs';
import chalk from 'chalk';
import { concatMap, tap } from 'rxjs/operators';
import { getBinary } from '../utils/external-binaries';
import { actions } from '../ui';
import { FSWatcher, watch } from 'chokidar';
import { RecompilationScheduler } from '../utils/scheduler';
import { Packager } from '../package/packagr';

interface IServiceLogs {
  offline: string[];
  createDomain: string[];
  deploy: string[];
}

export class Service extends LernaNode {
  private status: ServiceStatus;
  private readonly _port: number;
  private process: ChildProcess;
  private logStream: WriteStream;
  private readonly _logs: IServiceLogs;
  private _slsYamlWatcher: FSWatcher;

  constructor(
    scheduler: RecompilationScheduler,
    graph: LernaGraph,
    node: IGraphElement,
    nodes: Set<LernaNode>,
    elements: IGraphElement[],
  ) {
    super(scheduler, graph, node, nodes, elements);
    this.status = ServiceStatus.STOPPED;
    this._port = graph.getPort(node.name);
    this._logs = {
      offline: [],
      createDomain: [],
      deploy: [],
    };
  }

  public getStatus(): ServiceStatus {
    return this.status;
  }

  get logs(): IServiceLogs {
    return this._logs;
  }

  get port(): number {
    return this._port;
  }

  public stop(): Observable<Service> {
    return new Observable<Service>((observer) => {
      this.getGraph()
        .logger.log('service')
        .debug('Requested to stop', this.name, 'which status is', this.status);
      switch (this.status) {
        case ServiceStatus.RUNNING:
        case ServiceStatus.STARTING:
          this.process.kill();
          break;
        case ServiceStatus.STOPPING:
          this.getGraph()
            .logger.log('service')
            .warn('Requested to stop a service that already stopping', this.name);
          break;
        case ServiceStatus.CRASHED:
        case ServiceStatus.STOPPED:
          this.getGraph()
            .logger.log('service')
            .warn('Requested to stop a service that is not running', this.name);
          observer.next(this);
          return observer.complete();
      }
      this.process.on('close', (code) => {
        if (code === 0) {
          this.getGraph()
            .logger.log('service')
            .info(`Service ${this.name} exited with code ${code}`);
          this._updateStatus(ServiceStatus.STOPPED);
        } else {
          this.getGraph()
            .logger.log('service')
            .error(`Service ${this.name} exited with code ${code}`);
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
      this.getGraph()
        .logger.log('service')
        .debug('Requested to start', this.name, 'which status is', this.status);
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
          this.getGraph()
            .logger.log('service')
            .warn('Service is already stopping', this.name);
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
          this.getGraph()
            .logger.log('service')
            .warn('Service is already starting', this.name);
          this._watchStarted().subscribe(
            (next) => observer.next(next),
            (err) => observer.error(err),
            () => observer.complete(),
          );
          break;
        case ServiceStatus.RUNNING:
          this.getGraph()
            .logger.log('service')
            .warn('Service is already running', this.name);
          observer.next(this);
          return observer.complete();
      }
    });
  }

  private _watchServerlessYaml(): void {
    this._slsYamlWatcher = watch(`${this.location}/serverless.{yml,yaml}`);
    this._slsYamlWatcher.on('change', (path) => {
      this.getGraph()
        .logger.log('node')
        .info(`${chalk.bold(this.name)}: ${path} changed. Recompiling`);
      this._scheduler.restartOne(this);
    });
  }

  protected async _unwatchServerlessYaml(): Promise<void> {
    if (this._slsYamlWatcher) {
      await this._slsYamlWatcher.close();
    }
  }

  private _startProcess(): void {
    this._updateStatus(ServiceStatus.STARTING);
    createLogFile(this.graph.getProjectRoot(), this.name, 'offline');
    this.getGraph()
      .logger.log('service')
      .info(`Starting ${this.name} on localhost:${this.port}`);
    this.getGraph()
      .logger.log('service')
      .debug('Location:', this.location);
    this.getGraph()
      .logger.log('service')
      .debug('Env:', process.env.ENV);
    this.logStream = createWriteStream(getLogsPath(this.graph.getProjectRoot(), this.name, 'offline'));
    this.process = spawn('npm', ['start', '--', '--port', this.port.toString()], {
      cwd: this.location,
      env: { ...process.env, FORCE_COLOR: '2' },
    });
    this.process.stderr.on('data', (data) => {
      this.getGraph()
        .logger.log('service')
        .error(`${chalk.bold(this.name)}: ${data}`);
      this._handleLogs(data);
    });
  }

  private _watchStarted(): Observable<Service> {
    return new Observable<Service>((started) => {
      this.process.stdout.on('data', (data) => {
        this._handleLogs(data);
        if (data.includes('listening on')) {
          this.getGraph()
            .logger.log('service')
            .info(`${chalk.bold.bgGreenBright('success')}: ${this.name} listening localhost:${this.port}`);
          this._updateStatus(ServiceStatus.RUNNING);
          started.next(this);
          return started.complete();
        }
      });
      this.process.on('close', (code) => {
        if (code !== 0) {
          this.getGraph()
            .logger.log('service')
            .error(`Service ${this.name} exited with code ${code}`);
          this._updateStatus(ServiceStatus.CRASHED);
          // this.process.removeAllListeners('close');
          return started.error();
        }
      });
      this.process.on('error', (err) => {
        this.getGraph()
          .logger.log('service')
          .error(`Could not start service ${this.name}`, err);
        this._updateStatus(ServiceStatus.CRASHED);
        return started.error(err);
      });
    });
  }

  private _handleLogs(data: Buffer): void {
    this.logStream.write(data);
    this._logs.offline.push(data.toString());
    this.getGraph().io.handleServiceLog(this.name, data.toString());
  }

  private _updateStatus(status: ServiceStatus): void {
    if (status === ServiceStatus.RUNNING) {
      this._watchServerlessYaml();
    } else {
      this._unwatchServerlessYaml().then(() => {
        this.getGraph()
          .logger.log('service')
          .debug(`${this.name}: Unwatched serverless.yml`);
      });
    }
    this.status = status;
    this._ipc.graphUpdated();
    this.getGraph().io.statusUpdated(this, this.status);
    actions.updateServiceStatus(this);
  }

  isRunning(): boolean {
    return this.status === ServiceStatus.RUNNING;
  }

  package(level = 4): Observable<{ service: Service; megabytes: number }> {
    return new Observable<{ service: Service; megabytes: number }>((obs) => {
      const packagr = new Packager(this.graph, this, this.graph.logger);
      packagr
        .generateZip(this, level)
        .then((megabytes) => {
          obs.next({ service: this, megabytes });
          obs.complete();
        })
        .catch((err) => obs.error(err));
    });
  }

  async deploy(region: string, stage: string): Promise<void> {
    return new Promise((resolve, reject) => {
      createLogFile(this.graph.getProjectRoot(), this.name, 'deploy');
      const writeStream = createWriteStream(getLogsPath(this.graph.getProjectRoot(), this.name, 'deploy'));
      const deployProcess = spawn('npm', ['run', 'deploy'], {
        cwd: this.location,
        env: { ...process.env, ENV: stage, FORCE_COLOR: '2', MILA_REGION: region, AWS_REGION: region },
        stdio: 'pipe',
      });
      deployProcess.stderr.on('data', (data) => {
        writeStream.write(data);
        this._logs.deploy.push(data);
      });
      deployProcess.stdout.on('data', (data) => {
        writeStream.write(data);
        this._logs.deploy.push(data);
      });
      deployProcess.on('close', (code) => {
        writeStream.close();
        if (code !== 0) {
          return reject(code);
        }
        return resolve();
      });
      deployProcess.on('error', (err) => {
        writeStream.close();
        return reject(err);
      });
    });
  }

  async createCustomDomain(region: string, stage: string): Promise<void> {
    return new Promise((resolve, reject) => {
      createLogFile(this.graph.getProjectRoot(), this.name, 'createDomain');
      const writeStream = createWriteStream(getLogsPath(this.graph.getProjectRoot(), this.name, 'createDomain'));
      const createDomainProcess = spawn(
        getBinary('sls', this.graph.getProjectRoot(), this.getGraph().logger, this),
        ['create_domain'],
        {
          cwd: this.location,
          env: { ...process.env, ENV: stage, FORCE_COLOR: '2', AWS_REGION: region },
          stdio: 'pipe',
        },
      );
      createDomainProcess.stderr.on('data', (data) => {
        writeStream.write(data);
        this._logs.createDomain.push(data);
      });
      createDomainProcess.stdout.on('data', (data) => {
        writeStream.write(data);
        this._logs.createDomain.push(data);
      });
      createDomainProcess.on('close', (code) => {
        writeStream.close();
        if (code !== 0) {
          return reject(code);
        }
        return resolve();
      });
      createDomainProcess.on('error', (err) => {
        writeStream.close();
        return reject(err);
      });
    });
  }
}
