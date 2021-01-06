"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Service = void 0;
const tslib_1 = require("tslib");
const _1 = require("./");
const fs_1 = require("fs");
const child_process_1 = require("child_process");
const logs_1 = require("../logs");
const rxjs_1 = require("rxjs");
const chalk_1 = tslib_1.__importDefault(require("chalk"));
const operators_1 = require("rxjs/operators");
const external_binaries_1 = require("../external-binaries");
const chokidar_1 = require("chokidar");
const packagr_1 = require("../package/packagr");
const project_1 = require("../yarn/project");
class Service extends _1.Node {
    constructor(scheduler, graph, workspace, nodes, project) {
        super(scheduler, graph, workspace, nodes, project);
        this._slsLogs$ = new rxjs_1.BehaviorSubject('');
        this._status$ = new rxjs_1.BehaviorSubject(_1.ServiceStatus.STOPPED);
        this.status$ = this._status$.asObservable();
        this.slsLogs$ = this._slsLogs$.asObservable();
        this.status = _1.ServiceStatus.STOPPED;
        this._port = graph.getPort(project_1.getName(workspace));
        this._logs = {
            offline: [],
            createDomain: [],
            deploy: [],
        };
    }
    getStatus() {
        return this.status;
    }
    get logs() {
        return this._logs;
    }
    get port() {
        return this._port;
    }
    stop() {
        return new rxjs_1.Observable((observer) => {
            this.getGraph()
                .logger.log('service')
                .debug('Requested to stop', this.name, 'which status is', this.status);
            switch (this.status) {
                case _1.ServiceStatus.RUNNING:
                case _1.ServiceStatus.STARTING:
                    this.process.kill();
                    break;
                case _1.ServiceStatus.STOPPING:
                    this.getGraph()
                        .logger.log('service')
                        .warn('Requested to stop a service that already stopping', this.name);
                    break;
                case _1.ServiceStatus.CRASHED:
                case _1.ServiceStatus.STOPPED:
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
                    this._updateStatus(_1.ServiceStatus.STOPPED);
                }
                else {
                    this.getGraph()
                        .logger.log('service')
                        .error(`Service ${this.name} exited with code ${code}`);
                    this._updateStatus(_1.ServiceStatus.CRASHED);
                }
                this.process = null;
                observer.next(this);
                return observer.complete();
            });
        });
    }
    start() {
        return new rxjs_1.Observable((observer) => {
            this.getGraph()
                .logger.log('service')
                .debug('Requested to start', this.name, 'which status is', this.status);
            switch (this.status) {
                case _1.ServiceStatus.CRASHED:
                case _1.ServiceStatus.STOPPED:
                    this._startProcess();
                    this._watchStarted().subscribe((next) => observer.next(next), (err) => observer.error(err), () => observer.complete());
                    break;
                case _1.ServiceStatus.STOPPING:
                    this.getGraph()
                        .logger.log('service')
                        .warn('Service is already stopping', this.name);
                    this.stop()
                        .pipe(operators_1.tap(() => this._startProcess()), operators_1.concatMap(() => this._watchStarted()))
                        .subscribe((next) => observer.next(next), (err) => observer.error(err), () => observer.complete());
                    break;
                case _1.ServiceStatus.STARTING:
                    this.getGraph()
                        .logger.log('service')
                        .warn('Service is already starting', this.name);
                    this._watchStarted().subscribe((next) => observer.next(next), (err) => observer.error(err), () => observer.complete());
                    break;
                case _1.ServiceStatus.RUNNING:
                    this.getGraph()
                        .logger.log('service')
                        .warn('Service is already running', this.name);
                    observer.next(this);
                    return observer.complete();
            }
        });
    }
    _watchServerlessYaml() {
        this._slsYamlWatcher = chokidar_1.watch(`${this.location}/serverless.{yml,yaml}`);
        this._slsYamlWatcher.on('change', (path) => {
            this.getGraph()
                .logger.log('node')
                .info(`${chalk_1.default.bold(this.name)}: ${path} changed. Recompiling`);
            this._scheduler.restartOne(this);
        });
    }
    async _unwatchServerlessYaml() {
        if (this._slsYamlWatcher) {
            await this._slsYamlWatcher.close();
        }
    }
    _startProcess() {
        this._updateStatus(_1.ServiceStatus.STARTING);
        logs_1.createLogFile(this.graph.getProjectRoot(), this.name, 'offline');
        this.getGraph()
            .logger.log('service')
            .info(`Starting ${this.name} on localhost:${this.port}`);
        this.getGraph()
            .logger.log('service')
            .debug('Location:', this.location);
        this.getGraph()
            .logger.log('service')
            .debug('Env:', process.env.ENV);
        this.logStream = fs_1.createWriteStream(logs_1.getLogsPath(this.graph.getProjectRoot(), this.name, 'offline'));
        this.process = child_process_1.spawn('yarn', ['start', '--', '--port', this.port.toString()], {
            cwd: this.location,
            env: { ...process.env, FORCE_COLOR: '2' },
        });
        this.process.stderr.on('data', (data) => {
            this.getGraph()
                .logger.log('service')
                .error(`${chalk_1.default.bold(this.name)}: ${data}`);
            this._handleLogs(data);
        });
    }
    _watchStarted() {
        return new rxjs_1.Observable((started) => {
            this.process.stdout.on('data', (data) => {
                this._handleLogs(data);
                if (data.includes('listening on')) {
                    this.getGraph()
                        .logger.log('service')
                        .info(`${chalk_1.default.bold.bgGreenBright('success')}: ${this.name} listening localhost:${this.port}`);
                    this._updateStatus(_1.ServiceStatus.RUNNING);
                    started.next(this);
                    return started.complete();
                }
            });
            this.process.on('close', (code) => {
                if (code !== 0) {
                    this.getGraph()
                        .logger.log('service')
                        .error(`Service ${this.name} exited with code ${code}`);
                    this._updateStatus(_1.ServiceStatus.CRASHED);
                    return started.error();
                }
            });
            this.process.on('error', (err) => {
                this.getGraph()
                    .logger.log('service')
                    .error(`Could not start service ${this.name}`, err);
                this._updateStatus(_1.ServiceStatus.CRASHED);
                return started.error(err);
            });
        });
    }
    _handleLogs(data) {
        this.logStream.write(data);
        this._logs.offline.push(data.toString());
        this._slsLogs$.next(data.toString());
    }
    _updateStatus(status) {
        if (status === _1.ServiceStatus.RUNNING) {
            this._watchServerlessYaml();
        }
        else {
            this._unwatchServerlessYaml().then(() => {
                this.getGraph()
                    .logger.log('service')
                    .debug(`${this.name}: Unwatched serverless.yml`);
            });
        }
        this.status = status;
        this._ipc.graphUpdated();
        this._status$.next(this.status);
    }
    isRunning() {
        return this.status === _1.ServiceStatus.RUNNING;
    }
    package(restore = true, level = 4) {
        return new rxjs_1.Observable((obs) => {
            const packagr = new packagr_1.Packager(this.graph, this, this.graph.logger);
            packagr
                .generateZip(this, level, restore, 'ignore')
                .then((megabytes) => {
                obs.next({ service: this, megabytes });
                obs.complete();
            })
                .catch((err) => obs.error(err));
        });
    }
    async deploy(region, stage) {
        return new Promise((resolve, reject) => {
            logs_1.createLogFile(this.graph.getProjectRoot(), this.name, 'deploy');
            const writeStream = fs_1.createWriteStream(logs_1.getLogsPath(this.graph.getProjectRoot(), this.name, 'deploy'));
            const deployProcess = child_process_1.spawn('yarn', ['run', 'deploy'], {
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
    async createCustomDomain(region, stage) {
        return new Promise((resolve, reject) => {
            logs_1.createLogFile(this.graph.getProjectRoot(), this.name, 'createDomain');
            const writeStream = fs_1.createWriteStream(logs_1.getLogsPath(this.graph.getProjectRoot(), this.name, 'createDomain'));
            const createDomainProcess = child_process_1.spawn(external_binaries_1.getBinary('sls', this.graph.getProjectRoot(), this.getGraph().logger, this), ['create_domain'], {
                cwd: this.location,
                env: { ...process.env, ENV: stage, FORCE_COLOR: '2', MILA_REGION: region, AWS_REGION: region },
                stdio: 'pipe',
            });
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
exports.Service = Service;
//# sourceMappingURL=service.js.map