import { DependenciesGraph, Node } from './';
import { createWriteStream, WriteStream } from 'fs';
import { ChildProcess, spawn } from 'child_process';
import { createLogFile, getLogsPath } from '../logs';
import { BehaviorSubject, Observable } from 'rxjs';
import chalk from 'chalk';
import { concatMap, tap } from 'rxjs/operators';
import { getBinary } from '../external-binaries';
import { FSWatcher, watch } from 'chokidar';
import { RecompilationScheduler } from '../scheduler';
import { Packager } from '../package/packagr';
import { Project, Workspace } from '@yarnpkg/core';
import { getName } from '../yarn/project';
import { IServiceLogs, ServiceStatus, TranspilingStatus } from '@microlambda/types';
import { isPortAvailable } from '../resolve-ports';
import processTree from 'ps-tree';

export class Service extends Node {
  private status: ServiceStatus;
  private readonly _port: number;
  private process: ChildProcess | undefined;
  private logStream: WriteStream | undefined;
  private readonly _logs: IServiceLogs;
  private _slsYamlWatcher: FSWatcher | undefined;
  private _slsLogs$: BehaviorSubject<string> = new BehaviorSubject<string>('');
  private _status$: BehaviorSubject<ServiceStatus> = new BehaviorSubject<ServiceStatus>(ServiceStatus.STOPPED);
  public status$ = this._status$.asObservable();
  public slsLogs$ = this._slsLogs$.asObservable();
  private _startedBeganAt: number | undefined;
  private _ipc: any;

  constructor(
    graph: DependenciesGraph,
    workspace: Workspace,
    nodes: Set<Node>,
    project: Project,
    scheduler?: RecompilationScheduler,
  ) {
    super(graph, workspace, nodes, project, scheduler);
    this.status = ServiceStatus.STOPPED;
    this._port = graph.getPort(getName(workspace));
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

  private _killProcessTree(signal: 'SIGTERM' | 'SIGKILL' = 'SIGTERM') {
    if (this.process) {
      processTree(this.process.pid, (err, children) => {
        if (err) {
          this._logger?.error('Cannot get process tree', err);
          this.process?.kill(signal);
        }
        children.forEach((child) => process.kill(Number(child.PID), signal));
      });
    } else {
      this._logger?.error('No process to kill');
    }
  }

  public stop(): Observable<Service> {
    return new Observable<Service>((observer) => {
      this._logger?.debug('Requested to stop', this.name, 'which status is', this.status);
      const watchKilled = () => {
        if (this.process) {
          this._logger?.debug('Waiting for process to be killed');
          this.process.on('exit', () => {
            this._logger?.debug('Process exited');
            this._updateStatus(ServiceStatus.STOPPED);
          });
          this.process.on('close', (code) => {
            this._logger?.debug('Process closed', { code })
            if (code === 0) {
              this._logger?.info(`Service ${this.name} exited with code ${code}`);
              this._updateStatus(ServiceStatus.STOPPED);
            } else {
              this._logger?.error(`Service ${this.name} exited with code ${code}`);
              this._updateStatus(ServiceStatus.CRASHED);
            }
          });
          // Make sure process released port
          setTimeout(async () => {
            this._logger?.debug('Making sure process has released port');
            const isAvailable = await isPortAvailable(this.port);
            this._logger?.debug('Is port available', isAvailable);
            if (!isAvailable) {
              this._logger?.warn('Process has no released port within 200ms. Sending SIGKILL');
              this._killProcessTree('SIGKILL');
            }
            observer.next(this);
            return observer.complete();
          }, 200);
        }
      }
      switch (this.status) {
        case ServiceStatus.RUNNING:
        case ServiceStatus.STARTING:
          if (this.process) {
            this._logger?.debug('Request to kill process');
            watchKilled();
            this._killProcessTree();
          } else {
            const msg = `No process found to kill ${this.getName()}`;
            this._logger?.error(msg);
            observer.error(msg);
          }
          break;
        case ServiceStatus.STOPPING:
          this._logger?.warn('Requested to stop a service that already stopping', this.name);
          watchKilled();
          break;
        case ServiceStatus.CRASHED:
        case ServiceStatus.STOPPED:
          this._logger?.warn('Requested to stop a service that is not running', this.name);
          observer.next(this);
          return observer.complete();
      }
    });
  }

  public start(): Observable<Service> {
    return new Observable<Service>((observer) => {
      this._logger?.debug('Requested to start', this.name, 'which status is', this.status);
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
          this._logger?.warn('Service is already stopping', this.name);
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
          this._logger?.warn('Service is already starting', this.name);
          this._watchStarted().subscribe(
            (next) => observer.next(next),
            (err) => observer.error(err),
            () => observer.complete(),
          );
          break;
        case ServiceStatus.RUNNING:
          this._logger?.warn('Service is already running', this.name);
          observer.next(this);
          return observer.complete();
      }
    });
  }

  private _watchServerlessYaml(): void {
    this._slsYamlWatcher = watch(`${this.location}/serverless.{yml,yaml}`);
    this._slsYamlWatcher.on('change', (path) => {
      if (this._scheduler) {
        this._logger?.info(`${chalk.bold(this.name)}: ${path} changed. Recompiling`);
        this._scheduler.restartOne(this);
      }
    });
  }

  protected async _unwatchServerlessYaml(): Promise<void> {
    if (this._slsYamlWatcher) {
      await this._slsYamlWatcher.close();
    }
  }

  private _startProcess(): void {
    this._updateStatus(ServiceStatus.STARTING);
    this._startedBeganAt = Date.now();
    this.setTranspilingStatus(TranspilingStatus.TRANSPILING);
    createLogFile(this.graph.getProjectRoot(), this.name, 'offline');
    this._logger?.info(`Starting ${this.name} on localhost:${this.port}`);
    this._logger?.debug('Location:', this.location);
    this._logger?.debug('Env:', process.env.ENV);
    this.logStream = createWriteStream(getLogsPath(this.graph.getProjectRoot(), this.name, 'offline'));
    // TODO: argument --port have been changed to --httpPort on serverless-offline@6
    // We should either delegate to yarn start script to port mapping, either check sls version and choose appropriate arg
    this.process = spawn('yarn', ['start', '--port', this.port.toString()], {
      cwd: this.location,
      env: { ...process.env, FORCE_COLOR: '2' },
    });
    if (this.process.stderr) {
      this.process.stderr.on('data', (data) => {
        this._logger?.error(`${chalk.bold(this.name)}: ${data}`);
        this._handleLogs(data);
      });
    }
  }

  private _watchStarted(): Observable<Service> {
    return new Observable<Service>((started) => {
      if (!this.process) {
        const msg = 'No starting process to watch';
        this._logger?.error(msg);
        started.error(msg);
        return;
      }
      if (this.process.stdout) {
        this.process.stdout.on('data', (data) => {
          this._handleLogs(data);
          if (data.includes('listening on')) {
            this._logger?.info(`${chalk.bold.bgGreenBright('success')}: ${this.name} listening localhost:${this.port}`);
            this._metrics.lastStarted = new Date();
            this._metrics.startedTook = this._startedBeganAt ? Date.now() - this._startedBeganAt : null;
            this._startedBeganAt = undefined;
            this._updateStatus(ServiceStatus.RUNNING);
            this.setTranspilingStatus(TranspilingStatus.TRANSPILED);
            started.next(this);
            return started.complete();
          }
        });
      }
      this.process.on('close', (code) => {
        if (code !== 0) {
          this._logger?.error(`Service ${this.name} exited with code ${code}`);
          this.setTranspilingStatus(TranspilingStatus.NOT_TRANSPILED);
          this._updateStatus(ServiceStatus.CRASHED);
          this._startedBeganAt = undefined;
          // this.process.removeAllListeners('close');
          return started.error();
        }
      });
      this.process.on('error', (err) => {
        this._logger?.error(`Could not start service ${this.name}`, err);
        this.setTranspilingStatus(TranspilingStatus.NOT_TRANSPILED);
        this._updateStatus(ServiceStatus.CRASHED);
        this._startedBeganAt = undefined;
        return started.error(err);
      });
    });
  }

  private _handleLogs(data: Buffer): void {
    if (this.logStream) {
      this.logStream.write(data);
    } else {
      this._logger?.warn('Cannot write logs file for node', this.getName());
    }
    this._logs.offline.push(data.toString());
    this._slsLogs$.next(data.toString());
  }

  private _updateStatus(status: ServiceStatus): void {
    if (status === ServiceStatus.RUNNING) {
      this._watchServerlessYaml();
    } else {
      this._unwatchServerlessYaml().then(() => {
        this._logger?.debug(`${this.name}: Unwatched serverless.yml`);
      });
    }
    this.status = status;
    if (this._ipc) {
      this._ipc.graphUpdated();
    }
    this._logger?.debug('status updated', this.name, this.status);
    this._status$.next(this.status);
  }

  isRunning(): boolean {
    return this.status === ServiceStatus.RUNNING;
  }

  package(restore = true, level = 4): Observable<{ service: Service; megabytes: number }> {
    return new Observable<{ service: Service; megabytes: number }>((obs) => {
      const packagr = new Packager(this.graph, this, this.graph.logger);
      packagr
        .generateZip(this, level, restore, 'ignore')
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
      const deployProcess = spawn('yarn', ['run', 'deploy'], {
        cwd: this.location,
        env: {
          ...process.env,
          ENV: stage,
          FORCE_COLOR: '2',
          AWS_REGION: region,
        },
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
        getBinary('sls', this.graph.getProjectRoot(), this.graph.logger, this),
        ['create_domain'],
        {
          cwd: this.location,
          env: {
            ...process.env,
            ENV: stage,
            FORCE_COLOR: '2',
            AWS_REGION: region,
          },
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

  triggerRecompilation(): Observable<Service> {
    return new Observable<Service>((observer) => {
      this._logger?.debug('Requested to trigger recompilation for', this.name, 'which status is', this.status);
      switch (this.status) {
        case ServiceStatus.CRASHED:
        case ServiceStatus.STOPPED:
        case ServiceStatus.STOPPING:
        case ServiceStatus.STARTING:
          this._logger?.warn('Service is not running', this.name);
          break;
        case ServiceStatus.RUNNING:
          this._logger?.warn('Service is already running', this.name);
          observer.next(this);
          return observer.complete();
      }
    });
  }
}
