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
import { Project, Workspace } from '@yarnpkg/core';
import { getName } from '../yarn/project';
import { ServiceLogs, ServerlessAction, ServiceStatus, TranspilingStatus } from '@microlambda/types';
import { IServicePortsConfig, isPortAvailable } from '../resolve-ports';
import processTree from 'ps-tree';
import { ConfigReader } from '../';
import { readJSONSync } from 'fs-extra';
import { join } from 'path';

export interface IDeployEvent {
  type: 'started' | 'failed' | 'succeeded';
  region: string;
  service: Service;
  error?: unknown;
}

export class Service extends Node {
  private _status: ServiceStatus;
  private readonly _port: IServicePortsConfig;
  private _offlineProcess: ChildProcess | undefined;
  private readonly _logs: ServiceLogs;
  private readonly _logsStreams: Record<ServerlessAction, WriteStream>;
  private readonly _logs$: Record<ServerlessAction, BehaviorSubject<string>>;

  private readonly _status$: BehaviorSubject<ServiceStatus> = new BehaviorSubject<ServiceStatus>(ServiceStatus.STOPPED);
  private _slsYamlWatcher: FSWatcher | undefined;
  private _startedBeganAt: number | undefined;

  readonly status$ = this._status$.asObservable();
  readonly logs$: Record<ServerlessAction, Observable<string>>;

  constructor(
    graph: DependenciesGraph,
    workspace: Workspace,
    nodes: Set<Node>,
    project: Project,
    scheduler?: RecompilationScheduler,
  ) {
    super(graph, workspace, nodes, project, scheduler);
    this._status = ServiceStatus.STOPPED;
    this._port = graph.getPort(getName(workspace));
    this._logs = {
      start: [],
      package: [],
      deploy: [],
      remove: [],
    };
    createLogFile(this.graph.getProjectRoot(), this.name, 'start');
    createLogFile(this.graph.getProjectRoot(), this.name, 'package');
    createLogFile(this.graph.getProjectRoot(), this.name, 'deploy');
    createLogFile(this.graph.getProjectRoot(), this.name, 'remove');
    this._logsStreams = {
      start: createWriteStream(getLogsPath(this.graph.getProjectRoot(), this.name, 'start')),
      package: createWriteStream(getLogsPath(this.graph.getProjectRoot(), this.name, 'package')),
      deploy: createWriteStream(getLogsPath(this.graph.getProjectRoot(), this.name, 'deploy')),
      remove: createWriteStream(getLogsPath(this.graph.getProjectRoot(), this.name, 'remove')),
    };
    this._logs$ = {
      start: new BehaviorSubject<string>(''),
      package: new BehaviorSubject<string>(''),
      deploy: new BehaviorSubject<string>(''),
      remove: new BehaviorSubject<string>(''),
    };
    this.logs$ = {
      start: this._logs$.start.asObservable(),
      package: this._logs$.package.asObservable(),
      deploy: this._logs$.deploy.asObservable(),
      remove: this._logs$.remove.asObservable(),
    };
  }

  get status(): ServiceStatus {
    return this._status;
  }

  get logs(): ServiceLogs {
    return this._logs;
  }

  get port(): IServicePortsConfig {
    return this._port;
  }

  start(): Observable<Service> {
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

  stop(): Observable<Service> {
    return new Observable<Service>((observer) => {
      this._logger?.debug('Requested to stop', this.name, 'which status is', this.status);
      const watchKilled = (): void => {
        if (this._offlineProcess) {
          let killed = false;
          this._logger?.debug('Waiting for process to be killed');
          this._offlineProcess.on('exit', () => {
            // Child process exited, this means the process is over but some not all process in process tree are killed
            // i.e. hapi server spawn by sls offline still alive and still occupying his port
            this._logger?.debug('Process exited');
            this._updateStatus(ServiceStatus.STOPPED);
          });
          this._offlineProcess.on('close', (code) => {
            this._logger?.debug('Process closed', { code });
            if (code === 0) {
              this._logger?.info(`Service ${this.name} exited with code ${code}`);
              this._updateStatus(ServiceStatus.STOPPED);
            } else {
              this._logger?.error(`Service ${this.name} exited with code ${code}`);
              this._updateStatus(ServiceStatus.CRASHED);
            }
            // On close, we are sure that every process in process tree has exited, so we can complete observable
            // This is the most common scenario, where sls offline gracefully shutdown underlying hapi server and
            // close properly with status 0
            killed = true;
            observer.next(this);
            return observer.complete();
          });
          // This is a security to make child process release port, we give 5s to sls offline to gracefully
          // shutdown underlying hapi server (this is more than enough). Other wise we send SIGKILL to the whole
          // process tree to free the port (#Rampage)
          const FIVE_SECONDS = 5 * 1000;
          setTimeout(async () => {
            this._logger?.debug('Making sure process has released ports');

            const areAvailable = await Promise.all([
              isPortAvailable(this.port.http),
              isPortAvailable(this.port.lambda),
              isPortAvailable(this.port.websocket),
            ]);
            this._logger?.debug('Is port available', areAvailable);
            if (areAvailable.some((a) => !a) && !killed) {
              this._logger?.warn('Process has no released port within 5000ms. Sending SIGKILL');
              this._killProcessTree('SIGKILL');
            }
            observer.next(this);
            return observer.complete();
          }, FIVE_SECONDS);
        }
      };
      switch (this.status) {
        case ServiceStatus.RUNNING:
        case ServiceStatus.STARTING:
          if (this._offlineProcess) {
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

  package(): Observable<Service> {
    return new Observable<Service>((obs) => {
      this._runCommand('package')
        .then(() => {
          obs.next(this);
          obs.complete();
        })
        .catch((err) => obs.error(err));
    });
  }

  deploy(stage: string): Observable<IDeployEvent> {
    return this._stackUpdateRemove('Deploying', stage);
  }

  remove(stage: string): Observable<IDeployEvent> {
    return this._stackUpdateRemove('Removing', stage);
  }

  private _stackUpdateRemove(action: 'Deploying' | 'Removing', stage: string): Observable<IDeployEvent> {
    return new Observable<IDeployEvent>((obs) => {
      this._logger?.info(action, this.name);
      const reader = new ConfigReader();
      const regions = reader.getRegions(this.getName(), stage);
      this._logger?.info(`${action} ${this.name} in ${regions.length} regions`, regions);
      const processed: Array<Promise<Array<string>>> = [];
      for (const region of regions) {
        this._logger?.info(action, this.name, 'in', region);
        obs.next({ type: 'started', region, service: this });
        const promise = action === 'Deploying' ? this._deploy(region, stage) : this._remove(region, stage);
        processed.push(promise);
        promise
          .then(() => {
            obs.next({ type: 'succeeded', region, service: this });
          })
          .catch((e) => {
            obs.next({ type: 'failed', region, service: this, error: e });
          });
      }
      Promise.all(processed).finally(() => {
        obs.complete();
      });
    });
  }

  private _killProcessTree(signal: 'SIGTERM' | 'SIGKILL' = 'SIGTERM'): void {
    if (this._offlineProcess) {
      processTree(this._offlineProcess.pid, (err, children) => {
        if (err) {
          this._logger?.error('Cannot get process tree', err);
          this._offlineProcess?.kill(signal);
        }
        children.forEach((child) => process.kill(Number(child.PID), signal));
      });
    } else {
      this._logger?.error('No process to kill');
    }
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

  // TODO: Factorize with _runCommand
  private _startProcess(): void {
    this._updateStatus(ServiceStatus.STARTING);
    this._startedBeganAt = Date.now();
    this.setTranspilingStatus(TranspilingStatus.TRANSPILING);
    this._logger?.info(`Starting ${this.name} on localhost:${this.port}`);
    this._logger?.debug('Location:', this.location);
    this._logger?.debug('Env:', process.env.ENV);
    // TODO: specify peer dependency serverless-offline@>=6
    this._offlineProcess = spawn(
      'yarn',
      [
        'start',
        '--httpPort',
        this.port.http.toString(),
        '--lambdaPort',
        this.port.lambda.toString(),
        '--websocketPort',
        this.port.websocket.toString(),
      ],
      {
        cwd: this.location,
        env: { ...process.env, FORCE_COLOR: '2' },
      },
    );
    if (this._offlineProcess.stderr) {
      this._offlineProcess.stderr.on('data', (data) => {
        this._logger?.error(`${chalk.bold(this.name)}: ${data}`);
        this._handleLogs(data, 'start');
      });
    }
  }

  private _watchStarted(): Observable<Service> {
    return new Observable<Service>((started) => {
      if (!this._offlineProcess) {
        const msg = 'No starting process to watch';
        this._logger?.error(msg);
        started.error(msg);
        return;
      }
      if (this._offlineProcess.stdout) {
        this._offlineProcess.stdout.on('data', (data) => {
          this._handleLogs(data, 'start');
          if (data.includes('listening on')) {
            this._logger?.info(
              `${chalk.bold.bgGreenBright('success')}: ${this.name} listening localhost:${this.port.http}`,
            );
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
      this._offlineProcess.on('close', (code) => {
        if (code !== 0) {
          this._logger?.error(`Service ${this.name} exited with code ${code}`);
          this.setTranspilingStatus(TranspilingStatus.NOT_TRANSPILED);
          this._updateStatus(ServiceStatus.CRASHED);
          this._startedBeganAt = undefined;
          // this.process.removeAllListeners('close');
          return started.error();
        }
      });
      this._offlineProcess.on('error', (err) => {
        this._logger?.error(`Could not start service ${this.name}`, err);
        this.setTranspilingStatus(TranspilingStatus.NOT_TRANSPILED);
        this._updateStatus(ServiceStatus.CRASHED);
        this._startedBeganAt = undefined;
        return started.error(err);
      });
    });
  }

  private _handleLogs(data: Buffer, action: ServerlessAction): void {
    if (this._logsStreams[action]) {
      this._logsStreams[action].write(data);
    } else {
      this._logger?.warn('Cannot write logs file for node', this.getName());
    }
    this._logs[action].push(data.toString());
    this._logs$[action].next(data.toString());
  }

  private _updateStatus(status: ServiceStatus): void {
    if (status === ServiceStatus.RUNNING) {
      this._watchServerlessYaml();
    } else {
      this._unwatchServerlessYaml().then(() => {
        this._logger?.debug(`${this.name}: Unwatched serverless.yml`);
      });
    }
    this._status = status;
    if (this._ipc) {
      this._ipc.graphUpdated();
    }
    this._logger?.debug('status updated', this.name, this.status);
    this._status$.next(this.status);
  }

  isRunning(): boolean {
    return this.status === ServiceStatus.RUNNING;
  }

  private _getCommand(action: ServerlessAction): { cmd: string; args: string[] } {
    const hasScript = (key: string): boolean => {
      try {
        const scripts = readJSONSync(join(this.location, 'package.json')).scripts;
        return scripts[key] != null;
      } catch (e) {
        this._logger?.warn('Cannot determine if service has remove script');
        return false;
      }
    };
    const useYarn = hasScript(action);
    const cmd = useYarn ? 'yarn' : getBinary('sls', this.graph.getProjectRoot());
    return { cmd, args: this._getCommandArgs(action, useYarn) };
  }

  private _getCommandArgs(action: ServerlessAction, useYarn: boolean): string[] {
    if (useYarn) {
      return ['run', action];
    }
    if (action !== 'start') {
      return [action];
    }
    return [
      'offline',
      'start',
      '--httpPort',
      this.port.http.toString(),
      '--lambdaPort',
      this.port.lambda.toString(),
      '--websocketPort',
      this.port.websocket.toString(),
    ];
  }

  private async _runCommand(action: ServerlessAction, env: { [key: string]: string } = {}): Promise<string[]> {
    return new Promise<Array<string>>((resolve, reject) => {
      const { cmd, args } = this._getCommand(action);
      const deployProcess = spawn(cmd, args, {
        cwd: this.location,
        env: {
          ...process.env,
          FORCE_COLOR: '2',
          ...env,
        },
        stdio: 'pipe',
      });
      deployProcess.stderr.on('data', (data) => {
        this._handleLogs(data, action);
      });
      deployProcess.stdout.on('data', (data) => {
        this._handleLogs(data, action);
      });
      deployProcess.on('close', (code) => {
        this._logsStreams[action].close();
        if (code !== 0) {
          return reject(`Process exited with status ${code}`);
        }
        return resolve(this._logs[action]);
      });
      deployProcess.on('error', (err) => {
        this._logsStreams[action].close();
        return reject(err);
      });
    });
  }

  private async _deploy(region: string, stage: string): Promise<Array<string>> {
    return this._runCommand('deploy', {
      ENV: stage,
      AWS_REGION: region,
    });
  }

  private async _remove(region: string, stage: string): Promise<string[]> {
    return this._runCommand('remove', {
      ENV: stage,
      AWS_REGION: region,
    });
  }
}
