"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecompilationScheduler = exports.RecompilationMode = exports.RecompilationErrorType = exports.RecompilationEventType = void 0;
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const platform_1 = require("./platform");
const service_status_1 = require("./graph/enums/service.status");
var SchedulerStatus;
(function (SchedulerStatus) {
    SchedulerStatus[SchedulerStatus["READY"] = 0] = "READY";
    SchedulerStatus[SchedulerStatus["BUSY"] = 1] = "BUSY";
    SchedulerStatus[SchedulerStatus["ABORTED"] = 2] = "ABORTED";
})(SchedulerStatus || (SchedulerStatus = {}));
var RecompilationStatus;
(function (RecompilationStatus) {
    RecompilationStatus[RecompilationStatus["READY"] = 0] = "READY";
    RecompilationStatus[RecompilationStatus["STOPPING"] = 1] = "STOPPING";
    RecompilationStatus[RecompilationStatus["STOPPED"] = 2] = "STOPPED";
    RecompilationStatus[RecompilationStatus["COMPILING"] = 3] = "COMPILING";
    RecompilationStatus[RecompilationStatus["COMPILED"] = 4] = "COMPILED";
    RecompilationStatus[RecompilationStatus["STARTING"] = 5] = "STARTING";
    RecompilationStatus[RecompilationStatus["STARTED"] = 6] = "STARTED";
    RecompilationStatus[RecompilationStatus["FINISHED"] = 7] = "FINISHED";
})(RecompilationStatus || (RecompilationStatus = {}));
var RecompilationEventType;
(function (RecompilationEventType) {
    RecompilationEventType[RecompilationEventType["STOP_IN_PROGRESS"] = 0] = "STOP_IN_PROGRESS";
    RecompilationEventType[RecompilationEventType["STOP_SUCCESS"] = 1] = "STOP_SUCCESS";
    RecompilationEventType[RecompilationEventType["STOP_FAILURE"] = 2] = "STOP_FAILURE";
    RecompilationEventType[RecompilationEventType["TRANSPILE_IN_PROGRESS"] = 3] = "TRANSPILE_IN_PROGRESS";
    RecompilationEventType[RecompilationEventType["TRANSPILE_SUCCESS"] = 4] = "TRANSPILE_SUCCESS";
    RecompilationEventType[RecompilationEventType["TRANSPILE_FAILURE"] = 5] = "TRANSPILE_FAILURE";
    RecompilationEventType[RecompilationEventType["TYPE_CHECK_IN_PROGRESS"] = 6] = "TYPE_CHECK_IN_PROGRESS";
    RecompilationEventType[RecompilationEventType["TYPE_CHECK_SUCCESS"] = 7] = "TYPE_CHECK_SUCCESS";
    RecompilationEventType[RecompilationEventType["TYPE_CHECK_FAILURE"] = 8] = "TYPE_CHECK_FAILURE";
    RecompilationEventType[RecompilationEventType["START_IN_PROGRESS"] = 9] = "START_IN_PROGRESS";
    RecompilationEventType[RecompilationEventType["START_SUCCESS"] = 10] = "START_SUCCESS";
    RecompilationEventType[RecompilationEventType["START_FAILURE"] = 11] = "START_FAILURE";
    RecompilationEventType[RecompilationEventType["PACKAGE_IN_PROGRESS"] = 12] = "PACKAGE_IN_PROGRESS";
    RecompilationEventType[RecompilationEventType["PACKAGE_SUCCESS"] = 13] = "PACKAGE_SUCCESS";
    RecompilationEventType[RecompilationEventType["PACKAGE_FAILURE"] = 14] = "PACKAGE_FAILURE";
    RecompilationEventType[RecompilationEventType["DEPLOY_IN_PROGRESS"] = 15] = "DEPLOY_IN_PROGRESS";
    RecompilationEventType[RecompilationEventType["DEPLOY_SUCCESS"] = 16] = "DEPLOY_SUCCESS";
    RecompilationEventType[RecompilationEventType["DEPLOY_FAILURE"] = 17] = "DEPLOY_FAILURE";
})(RecompilationEventType = exports.RecompilationEventType || (exports.RecompilationEventType = {}));
var RecompilationErrorType;
(function (RecompilationErrorType) {
    RecompilationErrorType[RecompilationErrorType["TYPE_CHECK_ERROR"] = 0] = "TYPE_CHECK_ERROR";
    RecompilationErrorType[RecompilationErrorType["PACKAGE_ERROR"] = 1] = "PACKAGE_ERROR";
})(RecompilationErrorType = exports.RecompilationErrorType || (exports.RecompilationErrorType = {}));
var RecompilationMode;
(function (RecompilationMode) {
    RecompilationMode[RecompilationMode["FAST"] = 0] = "FAST";
    RecompilationMode[RecompilationMode["SAFE"] = 1] = "SAFE";
})(RecompilationMode = exports.RecompilationMode || (exports.RecompilationMode = {}));
class RecompilationScheduler {
    constructor(logger) {
        this._abort$ = new rxjs_1.Subject();
        this._filesChanged$ = new rxjs_1.Subject();
        this._logger = logger.log('scheduler');
        this._logger.debug('New recompilation scheduler instance');
        this._reset();
        this._debounce = 300;
        this._watchFileChanges();
        this._concurrency = platform_1.getDefaultThreads();
    }
    setGraph(graph) {
        this._graph = graph;
    }
    setConcurrency(threads) {
        this._concurrency = threads;
    }
    startOne(service) {
        this._compile(service.getDependencies());
        this._requestStart(service);
        return this._exec();
    }
    startAll() {
        this._graph.enableAll();
        const toStart = this._graph.getServices().filter((s) => s.getStatus() !== service_status_1.ServiceStatus.RUNNING);
        const roots = toStart.filter((n) => n.isRoot());
        this._compile(roots);
        toStart.forEach((s) => this._requestStart(s));
        return this._exec();
    }
    stopOne(service) {
        this._graph.disableOne(service);
        this._requestStop(service);
        return this._exec();
    }
    gracefulShutdown() {
        this._graph
            .getServices()
            .filter((s) => [service_status_1.ServiceStatus.RUNNING, service_status_1.ServiceStatus.STARTING].includes(s.getStatus()))
            .forEach((s) => this._requestStop(s));
        return this._exec();
    }
    stopAll() {
        this._graph.getNodes().forEach((n) => n.disable());
        return this.gracefulShutdown();
    }
    restartOne(service, recompile = false) {
        this._requestStop(service);
        this._compile([service], RecompilationMode.FAST, recompile);
        this._requestStart(service);
        return this._exec();
    }
    restartAll(recompile = true) {
        const toRestart = this._graph
            .getServices()
            .filter((s) => [service_status_1.ServiceStatus.RUNNING, service_status_1.ServiceStatus.STARTING].includes(s.getStatus()));
        toRestart.forEach((s) => this._requestStop(s));
        this._compile(toRestart.filter((s) => s.isRoot()), RecompilationMode.FAST, recompile);
        toRestart.forEach((s) => this._requestStart(s));
        return this._exec();
    }
    async startProject(graph, compile = true) {
        this._logger.debug('Starting project');
        if (compile) {
            this._logger.debug('Building compilation queue...', graph.getNodes().filter((n) => n.isEnabled()).length);
            this._compile(graph.getNodes().filter((n) => n.isEnabled()), RecompilationMode.FAST, false, false);
        }
        this._logger.debug('Compilation queue built', this._jobs.transpile.map((n) => n.getName()));
        this._logger.debug('Building start queue...');
        graph
            .getServices()
            .filter((s) => s.isEnabled())
            .forEach((service) => {
            this._requestStart(service);
        });
        this._logger.debug('Start queue built', this._jobs.start.map((n) => n.getName()));
        this._logger.debug('Executing tasks');
        const watch = () => {
            this._logger.info('Watching for file changes');
            graph.getNodes().forEach((n) => n.watch());
        };
        try {
            await this._execPromise();
            watch();
        }
        catch (e) {
            watch();
        }
    }
    stopProject(graph) {
        this._reset();
        graph
            .getServices()
            .filter((s) => s.isEnabled())
            .forEach((s) => this._requestStop(s));
        return this._execPromise();
    }
    fileChanged(node) {
        this._changes.add(node);
        this._filesChanged$.next();
    }
    _watchFileChanges() {
        this._filesChanged$
            .asObservable()
            .pipe(operators_1.debounceTime(this._debounce))
            .subscribe(async () => {
            if (this._changes.size > 0) {
                this._logger.info('Triggering recompilation...');
                this._reset();
                this._logger.info('Changed nodes', Array.from(this._changes).map((n) => n.getName()));
                const impactedServices = new Set();
                for (const node of this._changes) {
                    const isRunningService = (n) => {
                        if (n.isService()) {
                            const s = n;
                            return s.isRunning();
                        }
                        return false;
                    };
                    if (isRunningService(node)) {
                        impactedServices.add(node);
                    }
                    const dependantServices = node.getDependent().filter((n) => isRunningService(n));
                    dependantServices.forEach((s) => impactedServices.add(s));
                }
                this._logger.info('Restarting impacted running services', Array.from(impactedServices).map((n) => n.getName()));
                impactedServices.forEach((s) => this._requestStop(s));
                this._compile([...this._changes]);
                impactedServices.forEach((s) => this._requestStart(s));
                this._exec().subscribe();
            }
        });
    }
    recompileSafe(node, force = false) {
        this._compile([node], RecompilationMode.FAST, force);
    }
    _compile(target, mode = RecompilationMode.FAST, force = false, throws = true) {
        const toCompile = Array.isArray(target) ? target : [target];
        this._logger.debug('Requested to compile nodes', toCompile.map((n) => n.getName()));
        this._logger.debug('Recompilation mode', mode === RecompilationMode.FAST ? 'fast' : 'safe');
        const roots = toCompile.filter((n) => !n.getDependent().some((dep) => toCompile.includes(dep)));
        this._logger.debug('Root nodes', roots.map((n) => n.getName()));
        const recursivelyCompile = (nodes, requested, depth = 0) => {
            this._logger.debug('-'.repeat(depth), 'Recursively compile', nodes.map((n) => n.getName()));
            for (const node of nodes) {
                this._logger.debug('-'.repeat(depth), 'Request to compile', node.getName());
                const dependencies = node.getChildren().filter((d) => {
                    const inRequest = toCompile.includes(d);
                    const hasDescendantInRequest = d.getDependent().some((descendant) => toCompile.includes(descendant));
                    this._logger.debug('should compile ?', {
                        name: d.getName(),
                        inRequest,
                        hasDescendantInRequest,
                    });
                    return hasDescendantInRequest || inRequest;
                });
                this._logger.debug('-'.repeat(depth), 'Has dependencies', dependencies.map((d) => d.getName()));
                if (dependencies.length > 0) {
                    recursivelyCompile(dependencies, requested, depth + 1);
                }
                const alreadyCompiled = requested.has(node);
                if (alreadyCompiled) {
                    this._logger.debug('-'.repeat(depth), 'Already in compilation queue', node.getName());
                }
                else {
                    const isRootService = roots.includes(node) && node.isService();
                    if (mode === RecompilationMode.FAST && !isRootService) {
                        this._logger.debug('-'.repeat(depth), 'Added to transpiling queue', node.getName());
                        this._requestTranspile(node);
                    }
                    this._logger.debug('-'.repeat(depth), 'Added to type-checking queue', node.getName());
                    this._requestTypeCheck(node, force, throws);
                    requested.add(node);
                }
            }
        };
        recursivelyCompile(roots, new Set());
    }
    _reset() {
        this._logger.debug('Resetting scheduler');
        this._abort$.next();
        this._jobs = {
            stop: [],
            transpile: [],
            typeCheck: [],
            start: [],
            package: [],
        };
        this._recompilation = RecompilationStatus.READY;
        this._status = SchedulerStatus.READY;
        this._changes = new Set();
    }
    _requestStop(service) {
        this._logger.debug(`Request to add stop job`, service.getName());
        const inQueue = this._alreadyQueued(service, 'stop');
        this._logger.debug('Already in stop queue', inQueue);
        if (!inQueue) {
            this._logger.debug('Adding service in stop job queue', service.getName());
            this._jobs.stop.push(service);
        }
    }
    _requestTypeCheck(node, force, throws) {
        this._logger.debug(`Request to add typeCheck job`, node.getName());
        const inQueue = this._jobs.typeCheck.some((n) => n.node.getName() === node.getName());
        this._logger.debug('Already in typeCheck queue', inQueue);
        if (!inQueue) {
            this._logger.debug('Adding node in typeCheck queue', node.getName());
            this._jobs.typeCheck.push({ node, force, throws });
        }
    }
    _requestTranspile(node) {
        this._logger.debug(`Request to add transpile job`, node.getName());
        const inQueue = this._alreadyQueued(node, 'transpile');
        this._logger.debug('Already in transpile queue', inQueue);
        if (!inQueue) {
            this._logger.debug('Adding node in transpile queue', node.getName());
            this._jobs.transpile.push(node);
        }
    }
    _requestStart(service) {
        this._logger.debug(`Request to add start job`, service.getName());
        const inQueue = this._alreadyQueued(service, 'start');
        this._logger.debug('Already in start queue', inQueue);
        if (!inQueue) {
            this._logger.debug('Adding service in start job queue', service.getName());
            this._jobs.start.push(service);
        }
    }
    _requestPackage(service, level = 4) {
        this._logger.debug(`Request to add package job`, service.getName());
        const inQueue = this._jobs.package.some((n) => n.service.getName() === service.getName());
        this._logger.debug('Already in package queue', inQueue);
        if (!inQueue) {
            this._logger.debug('Adding service in package job queue', service.getName());
            this._jobs.package.push({ service, level });
        }
    }
    _alreadyQueued(node, queue) {
        return this._jobs[queue].some((n) => n.getName() === node.getName());
    }
    _execPromise() {
        return new Promise((resolve, reject) => {
            const recompilationProcess$ = this._exec();
            this._logger.debug('Recompilation process', recompilationProcess$);
            recompilationProcess$.subscribe((event) => this._logger.debug(event), (err) => {
                this._logger.error('exec promise error', err);
                return reject(err);
            }, () => {
                this._logger.info('resolving exec promise');
                return resolve();
            });
        });
    }
    _exec() {
        if (this._status === SchedulerStatus.BUSY) {
            this._logger.warn('Scheduler is already busy');
            this._reset();
        }
        if (this._status === SchedulerStatus.ABORTED) {
            this._logger.info('Previous recompilation has been preempted');
        }
        this._status = SchedulerStatus.BUSY;
        this._logger.info('Executing recompilation task');
        this._logger.info('To stop', this._jobs.stop.map((n) => n.getName()));
        this._logger.info('To transpile', this._jobs.transpile.map((n) => n.getName()));
        this._logger.info('To type-check', this._jobs.typeCheck.map((n) => n.node.getName()));
        this._logger.info('To start', this._jobs.start.map((n) => n.getName()));
        this._logger.info('To package', this._jobs.package.map((n) => n.service.getName()));
        const stopJobs$ = this._jobs.stop.map((node) => {
            return new rxjs_1.Observable((obs) => {
                obs.next({ node, type: RecompilationEventType.STOP_IN_PROGRESS });
                const now = Date.now();
                node.stop().subscribe((node) => {
                    this._logger.debug('Stopped', node.getName());
                    obs.next({ node: node, type: RecompilationEventType.STOP_SUCCESS, took: Date.now() - now });
                    return obs.complete();
                }, (err) => {
                    obs.next({ node: node, type: RecompilationEventType.STOP_FAILURE, took: Date.now() - now });
                    this._logger.error('Error stopping', node.getName(), err);
                    return obs.error(err);
                });
            });
        });
        const transpilingJobs$ = this._jobs.transpile.map((node) => {
            return new rxjs_1.Observable((obs) => {
                obs.next({ node, type: RecompilationEventType.TRANSPILE_IN_PROGRESS });
                const now = Date.now();
                node.transpile().subscribe((node) => {
                    this._logger.debug('Transpiled', node.getName());
                    obs.next({ node: node, type: RecompilationEventType.TRANSPILE_SUCCESS, took: Date.now() - now });
                    return obs.complete();
                }, (err) => {
                    obs.next({ node: node, type: RecompilationEventType.TYPE_CHECK_FAILURE, took: Date.now() - now });
                    this._logger.error('Error transpiling', err);
                    return obs.error(err);
                });
            });
        });
        const startJobs$ = this._jobs.start.map((service) => {
            return new rxjs_1.Observable((obs) => {
                obs.next({ node: service, type: RecompilationEventType.START_IN_PROGRESS });
                const now = Date.now();
                service.start().subscribe((node) => {
                    this._logger.debug('Service started', service.getName());
                    obs.next({ node: node, type: RecompilationEventType.START_SUCCESS, took: Date.now() - now });
                    return obs.complete();
                }, (err) => {
                    this._logger.error('Error starting', err);
                    const evt = {
                        type: RecompilationEventType.START_FAILURE,
                        node: service,
                    };
                    return obs.next(evt);
                });
            });
        });
        const typeCheckJobs$ = this._jobs.typeCheck.map((job) => {
            return new rxjs_1.Observable((obs) => {
                obs.next({ node: job.node, type: RecompilationEventType.TYPE_CHECK_IN_PROGRESS });
                const now = Date.now();
                job.node.performTypeChecking(job.force).subscribe((node) => {
                    this._logger.debug('Type checked', job.node.getName());
                    obs.next({ node: node, type: RecompilationEventType.TYPE_CHECK_SUCCESS, took: Date.now() - now });
                    return obs.complete();
                }, (err) => {
                    this._logger.error('Error typechecking', err);
                    obs.next({ node: job.node, type: RecompilationEventType.TYPE_CHECK_FAILURE, took: Date.now() - now });
                    if (job.throws) {
                        const evt = {
                            type: RecompilationErrorType.TYPE_CHECK_ERROR,
                            node: job.node,
                            logs: job.node.tscLogs,
                        };
                        return obs.error(evt);
                    }
                });
            });
        });
        const packageJobs$ = this._jobs.package.map((job) => {
            return new rxjs_1.Observable((obs) => {
                obs.next({ node: job.service, type: RecompilationEventType.PACKAGE_IN_PROGRESS });
                const now = Date.now();
                let i = 1;
                const isLast = i === packageJobs$.length;
                job.service.package(isLast, job.level).subscribe((output) => {
                    this._logger.debug('Service packaged', job.service.getName());
                    obs.next({
                        node: output.service,
                        type: RecompilationEventType.PACKAGE_SUCCESS,
                        took: Date.now() - now,
                        megabytes: output.megabytes,
                    });
                    i++;
                    return obs.complete();
                }, (err) => {
                    obs.next({ node: job.service, type: RecompilationEventType.PACKAGE_FAILURE, took: Date.now() - now });
                    this._logger.error('Error packaging', err);
                    const evt = {
                        type: RecompilationErrorType.PACKAGE_ERROR,
                        node: job.service,
                        logs: [err],
                    };
                    return obs.error(evt);
                });
            });
        });
        this._recompilation = RecompilationStatus.STOPPING;
        const stop$ = new rxjs_1.Observable((obs) => {
            let stopped = 0;
            const allDone = () => {
                this._logger.info('All services stopped');
                this._recompilation = RecompilationStatus.COMPILING;
            };
            if (stopJobs$.length === 0) {
                allDone();
                return obs.complete();
            }
            rxjs_1.from(stopJobs$)
                .pipe(operators_1.mergeMap((stopJob$) => stopJob$))
                .subscribe((evt) => {
                obs.next(evt);
                if (evt.type === RecompilationEventType.STOP_SUCCESS) {
                    stopped++;
                    this._logger.info(`Stopped ${stopped}/${stopJobs$.length} services`);
                    if (stopped >= stopJobs$.length) {
                        allDone();
                        return obs.complete();
                    }
                }
            }, (err) => {
                this._logger.error('Error stopping service', err);
                return obs.error(err);
            });
        });
        const transpile$ = new rxjs_1.Observable((obs) => {
            let transpiled = 0;
            const allDone = () => {
                this._logger.info('All dependencies transpiled');
                this._recompilation = RecompilationStatus.STARTING;
            };
            if (transpilingJobs$.length === 0) {
                allDone();
                return obs.complete();
            }
            rxjs_1.concat(transpilingJobs$)
                .pipe(operators_1.concatAll())
                .subscribe((evt) => {
                obs.next(evt);
                if (evt.type === RecompilationEventType.TRANSPILE_SUCCESS) {
                    transpiled++;
                    this._logger.info(`Transpiled ${transpiled}/${transpilingJobs$.length} services`);
                    if (transpiled >= transpilingJobs$.length) {
                        allDone();
                        return obs.complete();
                    }
                }
            }, (err) => {
                this._logger.error('Error transpiling service', err);
                return obs.error(err);
            });
        });
        const typeCheck$ = new rxjs_1.Observable((obs) => {
            let typeChecked = 0;
            const allDone = () => this._logger.info('Type-checking performed');
            if (typeCheckJobs$.length === 0) {
                allDone();
                return obs.complete();
            }
            rxjs_1.concat(typeCheckJobs$)
                .pipe(operators_1.concatAll())
                .subscribe((evt) => {
                obs.next(evt);
                if (evt.type === RecompilationEventType.TYPE_CHECK_SUCCESS) {
                    typeChecked++;
                    this._logger.info(`Type-checked ${typeChecked}/${typeCheckJobs$.length} services`);
                    if (typeChecked >= typeCheckJobs$.length) {
                        allDone();
                        return obs.complete();
                    }
                }
            }, () => {
                this._logger.warn('Typechecking failed !');
                return obs.complete();
            }, () => {
                this._logger.warn('All typechecking performed !');
                return obs.complete();
            });
        });
        const start$ = new rxjs_1.Observable((obs) => {
            let started = 0;
            const allDone = () => {
                this._logger.info('All services started');
                this._recompilation = RecompilationStatus.STARTING;
            };
            if (startJobs$.length === 0) {
                allDone();
                return obs.complete();
            }
            rxjs_1.from(startJobs$)
                .pipe(operators_1.mergeMap((startJob$) => startJob$))
                .subscribe((evt) => {
                obs.next(evt);
                if (evt.type === RecompilationEventType.START_FAILURE ||
                    evt.type === RecompilationEventType.START_SUCCESS) {
                    started++;
                    this._logger.info(`Started ${started}/${startJobs$.length} services`);
                    if (started >= startJobs$.length) {
                        allDone();
                        return obs.complete();
                    }
                }
            }, (err) => {
                this._logger.error('Error starting services');
                return obs.error(err);
            });
        });
        const package$ = new rxjs_1.Observable((obs) => {
            let packaged = 0;
            const allDone = () => {
                this._logger.info('All services packaged');
            };
            if (packageJobs$.length === 0) {
                allDone();
                return obs.complete();
            }
            rxjs_1.concat(packageJobs$)
                .pipe(operators_1.concatAll())
                .subscribe((evt) => {
                obs.next(evt);
                if (evt.type === RecompilationEventType.PACKAGE_SUCCESS) {
                    packaged++;
                    this._logger.info(`Packaged ${packaged}/${packageJobs$.length} services`);
                    if (packaged >= packageJobs$.length) {
                        allDone();
                        return obs.complete();
                    }
                }
            }, (err) => {
                this._logger.error('Error packaging services');
                return obs.error(err);
            });
        });
        const recompilationProcess$ = new rxjs_1.Observable((obs) => {
            rxjs_1.concat([stop$, rxjs_1.merge(rxjs_1.concat(typeCheck$, package$), rxjs_1.concat(transpile$, start$))])
                .pipe(operators_1.concatAll(), operators_1.takeUntil(this._abort$))
                .subscribe((evt) => obs.next(evt), (err) => {
                this._logger.error('Error happened in tasks execution', err);
                this._reset();
                return obs.error(err);
            }, () => {
                this._logger.info('All tasks finished');
                this._reset();
                return obs.complete();
            });
        });
        this._logger.info('All tasks successfully scheduled');
        return recompilationProcess$.pipe(operators_1.filter((evt) => !!evt));
    }
    buildOne(service, onlySelf, force) {
        if (onlySelf) {
            this._requestTypeCheck(service, force, true);
        }
        else {
            this._compile([service], RecompilationMode.SAFE, force);
        }
        return this._exec();
    }
    buildAll(graph, onlySelf, force) {
        if (onlySelf) {
            graph.getServices().forEach((s) => this._requestTypeCheck(s, force, true));
        }
        else {
            this._compile(graph.getServices(), RecompilationMode.SAFE, force);
        }
        return this._exec();
    }
    packageOne(service, level = 4) {
        this._requestPackage(service, level);
        return this._exec();
    }
    packageAll(graph, level = 4) {
        graph.getServices().forEach((s) => this._requestPackage(s, level));
        return this._exec();
    }
}
exports.RecompilationScheduler = RecompilationScheduler;
//# sourceMappingURL=scheduler.js.map