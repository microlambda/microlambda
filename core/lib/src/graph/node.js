"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Node = void 0;
const tslib_1 = require("tslib");
const dependencies_graph_1 = require("./dependencies-graph");
const fs_1 = require("fs");
const path_1 = require("path");
const _1 = require("./");
const compilation_status_1 = require("./enums/compilation.status");
const chalk_1 = tslib_1.__importDefault(require("chalk"));
const child_process_1 = require("child_process");
const rxjs_1 = require("rxjs");
const external_binaries_1 = require("../external-binaries");
const typescript_1 = require("../typescript");
const checksums_1 = require("../checksums");
const chokidar_1 = require("chokidar");
const project_1 = require("../yarn/project");
var NodeStatus;
(function (NodeStatus) {
    NodeStatus[NodeStatus["DISABLED"] = 0] = "DISABLED";
    NodeStatus[NodeStatus["ENABLED"] = 1] = "ENABLED";
})(NodeStatus || (NodeStatus = {}));
class Node {
    constructor(scheduler, graph, node, nodes, project) {
        this._typeCheckLogs = [];
        this._watchers = [];
        this._tscLogs$ = new rxjs_1.BehaviorSubject('');
        this._typeCheck$ = new rxjs_1.BehaviorSubject(compilation_status_1.TypeCheckStatus.NOT_CHECKED);
        this._transpiled$ = new rxjs_1.BehaviorSubject(compilation_status_1.TranspilingStatus.NOT_TRANSPILED);
        this.typeCheck$ = this._typeCheck$.asObservable();
        this.transpiled$ = this._transpiled$.asObservable();
        this.tscLogs$ = this._tscLogs$.asObservable();
        const logger = graph.logger.log('node');
        logger.debug('Building node', project_1.getName(node));
        this.graph = graph;
        this.name = project_1.getName(node);
        this.version = node.manifest.version;
        this.private = node.manifest.private;
        this.location = node.cwd;
        this.nodeStatus = NodeStatus.DISABLED;
        this.transpilingStatus = compilation_status_1.TranspilingStatus.NOT_TRANSPILED;
        this.typeCheckStatus = compilation_status_1.TypeCheckStatus.NOT_CHECKED;
        this._scheduler = scheduler;
        const workspaces = project.workspaces;
        const dependentWorkspaces = [];
        const dependencies = Array.from(node.manifest.dependencies.values());
        const devDependencies = Array.from(node.manifest.devDependencies.values());
        for (const descriptor of dependencies.concat(devDependencies)) {
            const name = project_1.getName(descriptor);
            const alreadyBuilt = Array.from(nodes).find((n) => n.name === name);
            if (alreadyBuilt) {
                logger.debug('Dependency is already built', alreadyBuilt);
                dependentWorkspaces.push(alreadyBuilt);
                continue;
            }
            logger.debug('Building dependency', descriptor);
            const workspace = workspaces.find((w) => project_1.getName(w) === name);
            if (!workspace) {
                logger.debug('is external dependency', name);
                continue;
            }
            logger.debug('Is service', { name, result: dependencies_graph_1.isService(workspace.cwd) });
            dependentWorkspaces.push(dependencies_graph_1.isService(workspace.cwd)
                ? new _1.Service(scheduler, graph, workspace, nodes, project)
                : new _1.Package(scheduler, graph, workspace, nodes, project));
        }
        this.dependencies = dependentWorkspaces;
        logger.debug('Node built', this.name);
        nodes.add(this);
    }
    get tscLogs() {
        return this._typeCheckLogs;
    }
    get lastTypeCheck() {
        return this._lastTypeCheck;
    }
    enable() {
        this.nodeStatus = NodeStatus.ENABLED;
    }
    disable() {
        this.nodeStatus = NodeStatus.DISABLED;
    }
    registerIPCServer(sockets) {
        this._ipc = sockets;
    }
    isEnabled() {
        return this.nodeStatus === NodeStatus.ENABLED;
    }
    isService() {
        this.getGraph()
            .logger.log('node')
            .debug('Is service', {
            node: this.getName(),
            location: path_1.join(this.location, 'serverless.yml'),
            result: fs_1.existsSync(path_1.join(this.location, 'serverless.yml')),
        });
        return fs_1.existsSync(path_1.join(this.location, 'serverless.yml')) || fs_1.existsSync(path_1.join(this.location, 'serverless.yaml'));
    }
    getTranspilingStatus() {
        return this.transpilingStatus;
    }
    getTypeCheckStatus() {
        return this.typeCheckStatus;
    }
    getChildren() {
        return this.dependencies;
    }
    getGraph() {
        return this.graph;
    }
    getVersion() {
        return this.version;
    }
    getChild(name) {
        return this.dependencies.find((d) => d.name === name);
    }
    setTranspilingStatus(status) {
        this.transpilingStatus = status;
        if (this._ipc) {
            this.getGraph()
                .logger.log('node')
                .debug('Notifying IPC server of graph update');
            this._ipc.graphUpdated();
        }
        this._transpiled$.next(this.transpilingStatus);
    }
    setTypeCheckingStatus(status) {
        this.typeCheckStatus = status;
        this._typeCheck$.next(this.typeCheckStatus);
    }
    isRoot() {
        return this.getDependent().length === 0;
    }
    getName() {
        return this.name;
    }
    getLocation() {
        return this.location;
    }
    getDependencies() {
        const deps = [];
        this._getDependencies(deps);
        return deps;
    }
    _getDependencies(deps) {
        for (const dep of this.dependencies) {
            deps.push(dep);
            dep._getDependencies(deps);
        }
    }
    getDependent() {
        const dependent = this.graph.getNodes().filter((n) => n
            .getDependencies()
            .map((n) => n.name)
            .includes(this.name));
        this.getGraph()
            .logger.log('node')
            .silly(`Nodes depending upon ${this.name}`, dependent.map((d) => d.name));
        return dependent;
    }
    getParents() {
        return this.graph.getNodes().filter((n) => n.dependencies.some((d) => d.name === this.name));
    }
    transpile() {
        return new rxjs_1.Observable((observer) => {
            switch (this.transpilingStatus) {
                case compilation_status_1.TranspilingStatus.TRANSPILED:
                case compilation_status_1.TranspilingStatus.ERROR_TRANSPILING:
                case compilation_status_1.TranspilingStatus.NOT_TRANSPILED:
                    this.transpilingPromise = this._startTranspiling();
                    break;
                case compilation_status_1.TranspilingStatus.TRANSPILING:
                    this.getGraph()
                        .logger.log('node')
                        .info('Package already transpiling', this.name);
                    break;
            }
            this.transpilingPromise
                .then(() => {
                this.getGraph()
                    .logger.log('node')
                    .info('Package transpiled', this.name);
                observer.next(this);
                this.setTranspilingStatus(compilation_status_1.TranspilingStatus.TRANSPILED);
                return observer.complete();
            })
                .catch((err) => {
                this.getGraph()
                    .logger.log('node')
                    .info(`Error transpiling ${this.getName()}`, err);
                this.setTranspilingStatus(compilation_status_1.TranspilingStatus.ERROR_TRANSPILING);
                return observer.error(err);
            });
        });
    }
    performTypeChecking(force = false) {
        return new rxjs_1.Observable((observer) => {
            switch (this.typeCheckStatus) {
                case compilation_status_1.TypeCheckStatus.SUCCESS:
                case compilation_status_1.TypeCheckStatus.ERROR:
                case compilation_status_1.TypeCheckStatus.NOT_CHECKED:
                    this._startTypeChecking(force).then((action) => {
                        if (action.recompile) {
                            this._watchTypeChecking().subscribe((next) => observer.next(next), (err) => observer.error(err), () => {
                                if (action.checksums != null) {
                                    checksums_1.checksums(this, this.getGraph().logger)
                                        .write(action.checksums)
                                        .then(() => {
                                        this.getGraph()
                                            .logger.log('node')
                                            .info('Checksum written', this.name);
                                        this._checksums = action.checksums;
                                        observer.complete();
                                    })
                                        .catch((e) => {
                                        this.getGraph()
                                            .logger.log('node')
                                            .debug(e);
                                        this.getGraph()
                                            .logger.log('node')
                                            .warn(`Error caching checksum for node ${this.name}. Next time node will be recompiled event if source does not change`);
                                        observer.complete();
                                    });
                                }
                                else {
                                    observer.complete();
                                }
                            });
                        }
                        else {
                            this.getGraph()
                                .logger.log('node')
                                .info(`Skipped type-checking of ${this.name}: sources did not change`);
                            this.setTypeCheckingStatus(compilation_status_1.TypeCheckStatus.SUCCESS);
                            this._typeCheckLogs = [
                                'Safe-compilation skipped, sources did not change since last type check. Checksums:',
                                JSON.stringify(this._checksums, null, 2),
                            ];
                            observer.next(this);
                            observer.complete();
                        }
                    });
                    break;
                case compilation_status_1.TypeCheckStatus.CHECKING:
                    this._watchTypeChecking().subscribe((next) => observer.next(next), (err) => observer.error(err), () => observer.complete());
                    break;
            }
        });
    }
    async _startTranspiling() {
        this.setTranspilingStatus(compilation_status_1.TranspilingStatus.TRANSPILING);
        this.getGraph()
            .logger.log('node')
            .info('Fast-compiling using transpile-only', this.name);
        return typescript_1.compileFiles(this.location, this.getGraph().logger);
    }
    async _startTypeChecking(force = false) {
        this.setTypeCheckingStatus(compilation_status_1.TypeCheckStatus.CHECKING);
        let recompile = true;
        let currentChecksums = null;
        const checksumUtils = checksums_1.checksums(this, this.getGraph().logger);
        if (!force) {
            try {
                const oldChecksums = await checksumUtils.read();
                currentChecksums = await checksumUtils.calculate();
                this._checksums = currentChecksums;
                recompile = checksumUtils.compare(oldChecksums, currentChecksums);
            }
            catch (e) {
                currentChecksums = await checksumUtils.calculate().catch(() => {
                    return null;
                });
                this.getGraph()
                    .logger.log('node')
                    .warn('Error evaluating checksums for node', this.name);
                this.getGraph()
                    .logger.log('node')
                    .debug(e);
            }
            this.getGraph()
                .logger.log('node')
                .info('Safe-compiling performing type-checks', this.name);
        }
        else {
            try {
                currentChecksums = await checksumUtils.calculate();
            }
            catch (e) {
                this.getGraph()
                    .logger.log('node')
                    .warn('Error evaluating checksums for node', this.name);
            }
        }
        if (recompile) {
            this.typeCheckProcess = child_process_1.spawn(external_binaries_1.getBinary('tsc', this.graph.getProjectRoot(), this.getGraph().logger, this), {
                cwd: this.location,
                env: { ...process.env, FORCE_COLOR: '2' },
            });
            this.typeCheckProcess.stderr.on('data', (data) => {
                this.getGraph()
                    .logger.log('tsc')
                    .error(`${chalk_1.default.bold(this.name)}: ${data}`);
                this._handleTscLogs(data);
            });
            this.typeCheckProcess.stdout.on('data', (data) => {
                this.getGraph()
                    .logger.log('tsc')
                    .info(`${chalk_1.default.bold(this.name)}: ${data}`);
                this._handleTscLogs(data);
            });
        }
        return { recompile, checksums: currentChecksums };
    }
    _handleTscLogs(data) {
        this._typeCheckLogs.push(data.toString());
        this._tscLogs$.next(data.toString());
    }
    _watchTypeChecking() {
        return new rxjs_1.Observable((observer) => {
            this.typeCheckProcess.on('close', (code) => {
                this.getGraph()
                    .logger.log('node')
                    .silly('npx tsc process closed');
                if (code === 0) {
                    this.setTypeCheckingStatus(compilation_status_1.TypeCheckStatus.SUCCESS);
                    this.getGraph()
                        .logger.log('node')
                        .info(`Package safe-compiled ${this.getName()}`);
                    observer.next(this);
                    this._lastTypeCheck = new Date().toISOString();
                    return observer.complete();
                }
                else {
                    this.setTypeCheckingStatus(compilation_status_1.TypeCheckStatus.ERROR);
                    this.getGraph()
                        .logger.log('node')
                        .info(`Error safe-compiling ${this.getName()}`);
                    return observer.error();
                }
            });
            this.typeCheckProcess.on('error', (err) => {
                this.getGraph()
                    .logger.log('node')
                    .silly('npx tsc process error');
                this.getGraph()
                    .logger.log('node')
                    .error(err);
                this.setTypeCheckingStatus(compilation_status_1.TypeCheckStatus.ERROR);
                this.getGraph()
                    .logger.log('node')
                    .info(`Error safe-compiling ${this.getName()}`, err);
                return observer.error(err);
            });
        });
    }
    watch() {
        this.getGraph()
            .logger.log('node')
            .info('Watching sources', `${this.location}/src/**/*.{ts,js,json}`);
        const watcher = chokidar_1.watch(`${this.location}/src/**/*.{ts,js,json}`);
        watcher.on('change', (path) => {
            this.getGraph()
                .logger.log('node')
                .info(`${chalk_1.default.bold(this.name)}: ${path} changed. Recompiling`);
            this._scheduler.fileChanged(this);
        });
        this._watchers.push(watcher);
    }
    unwatch() {
        this._watchers.forEach((w) => w.close());
    }
}
exports.Node = Node;
//# sourceMappingURL=node.js.map