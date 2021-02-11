"use strict";
const tslib_1 = require("tslib");
const chalk_1 = tslib_1.__importDefault(require("chalk"));
const core_1 = require("@microlambda/core");
const path_1 = require("path");
const chokidar_1 = require("chokidar");
class ServerlessMilaOffline {
    constructor(serverless, options) {
        this._log = {
            debug: (...args) => {
                if (process.env.SLS_DEBUG) {
                    this.serverless.cli.consoleLog(args);
                }
            },
            info: (...args) => {
                this.serverless.cli.log(args);
            },
            error: (...args) => {
                this.serverless.cli.log(chalk_1.default.red(args));
            }
        };
        this._assign = (obj, path, value) => {
            const segments = path.split('.');
            let ref = obj;
            for (const segment of segments.slice(0, segments.length - 1)) {
                if (!ref[segment]) {
                    ref[segment] = {};
                }
                ref = ref[segment];
            }
            ref[segments[segments.length - 1]] = value;
        };
        this.serverless = serverless;
        this.options = options;
        this.commands = {};
        this.hooks = {
            'before:offline:start': () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                yield this._beforeOffline();
            }),
            'before:offline:start:init': () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                yield this._beforeOffline();
            }),
        };
    }
    _beforeOffline() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            yield this._getDependenciesGraph();
            this._resolveCurrentService();
            this._resolveOutDir();
            yield this._transpile();
            this._assign(this.serverless, 'service.custom.serverless-offline.location', path_1.relative(process.cwd(), this._outDir || 'lib'));
            this._watch();
        });
    }
    _getDependenciesGraph() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const projectRoot = core_1.getProjectRoot();
            this._log.info(`Project root resolved ${projectRoot}`);
            this._config = new core_1.ConfigReader().readConfig();
            this._graph = yield core_1.getGraphFromYarnProject(projectRoot, this._config);
            this._log.info(`Dependencies graph resolved: ${this._graph.getNodes().length} nodes`);
        });
    }
    _resolveCurrentService() {
        var _a;
        this._log.debug(`cwd: ${process.cwd()}`);
        this._service = (_a = this._graph) === null || _a === void 0 ? void 0 : _a.getNodes().find((s) => s.getLocation() === process.cwd());
        if (!this._service) {
            this._log.error(`Error: cannot resolve microlambda service`);
            process.exit(1);
        }
        this._log.info(`Microlambda service resolved ${this._service.getName()}`);
        for (const dep of new Set(this._service.getDependencies())) {
            this._log.info(`-- Depends on ${dep.getName()}`);
        }
    }
    _resolveOutDir() {
        var _a;
        try {
            this._outDir = core_1.getTsConfig(process.cwd()).options.outDir;
        }
        catch (e) {
            this._log.error(`Error: cannot resolve typescript outDir`);
            process.exit(1);
        }
        this._log.info(`Transpiling ${(_a = this._service) === null || _a === void 0 ? void 0 : _a.getName()} to ${this._outDir}`);
    }
    _transpile() {
        var _a, _b;
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const now = Date.now();
            yield ((_a = this._service) === null || _a === void 0 ? void 0 : _a.transpile().toPromise());
            const took = Date.now() - now;
            this._log.info(`${(_b = this._service) === null || _b === void 0 ? void 0 : _b.getName()} transpiled in ${took}ms`);
        });
    }
    _watch() {
        const files = [];
        if (!this._service) {
            this._log.error(`Cannot watch: service not resolved`);
            return;
        }
        for (const dep of new Set([...this._service.getDependencies(), this._service])) {
            const tscConfig = core_1.getTsConfig(dep.getLocation());
            files.push(...tscConfig.fileNames);
        }
        files.forEach((f) => this._log.debug(`Watching ${f}`));
        const ignoreFistAdd = new Set();
        chokidar_1.watch(files).on('all', (event, path) => {
            if (event === 'add' && !ignoreFistAdd.has(path)) {
                ignoreFistAdd.add(path);
                return;
            }
            this._log.info(`${path} changed [${event}] - Recompiling...`);
            this._transpile();
        });
    }
}
module.exports = ServerlessMilaOffline;
