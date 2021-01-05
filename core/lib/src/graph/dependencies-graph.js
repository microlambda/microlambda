"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DependenciesGraph = exports.isService = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
const _1 = require("./");
const _2 = require("./");
const resolve_ports_1 = require("../resolve-ports");
const project_1 = require("../yarn/project");
exports.isService = (location) => {
    return fs_1.existsSync(path_1.join(location, 'serverless.yml')) || fs_1.existsSync(path_1.join(location, 'serverless.yaml'));
};
class DependenciesGraph {
    constructor(scheduler, project, config, logger, defaultPort) {
        this._logger = logger;
        this._config = config;
        this._project = project;
        this._logger.log('graph').debug('Building graph with', project);
        this.projectRoot = project.cwd;
        const services = project.workspaces.filter((n) => exports.isService(n.cwd));
        this.ports = resolve_ports_1.resolvePorts(services, config, this._logger, defaultPort);
        const builtNodes = new Set();
        this._logger.log('graph').debug(project.workspaces.map((w) => project_1.getName(w)));
        for (const node of project.workspaces) {
            if (!Array.from(builtNodes).some((n) => n.getName() === project_1.getName(node))) {
                this._logger.log('graph').debug('Building node', project_1.getName(node));
                this._logger.log('graph').debug('Already built', Array.from(builtNodes).map((b) => b.getName()));
                this._logger.log('graph').debug('Is service', exports.isService(node.cwd));
                exports.isService(node.cwd)
                    ? new _2.Service(scheduler, this, node, builtNodes, project)
                    : new _1.Package(scheduler, this, node, builtNodes, project);
            }
        }
        this.nodes = Array.from(builtNodes);
        this._logger.log('graph').debug('Built graph', this.nodes.map((n) => n.getName()));
        this._logger.log('graph').info(`Successfully built ${this.nodes.length} nodes`);
    }
    get logger() {
        return this._logger;
    }
    get project() {
        return this._project;
    }
    getPort(service) {
        return this.ports[service];
    }
    registerIPCServer(sockets) {
        this.getNodes().forEach((n) => n.registerIPCServer(sockets));
    }
    enableNodes() {
        this._logger.log('graph').debug('Enabling nodes descendants');
        this.nodes
            .filter((n) => n.isEnabled())
            .forEach((n) => {
            this._logger.log('graph').debug('Enabling node descendants', n.getName());
            const dependencies = n.getDependencies();
            this._logger.log('graph').silly('Descendants', n.getDependencies());
            dependencies.forEach((d) => d.enable());
        });
    }
    enableOne(node) {
        node.enable();
        node
            .getDependencies()
            .filter((n) => !n.isEnabled() && !this._config.noStart.includes(n.getName()))
            .forEach((n) => n.enable());
    }
    disableOne(node) {
        node.disable();
        node
            .getDependencies()
            .filter((n) => n.isEnabled() && !n.getDependent().some((ancestors) => ancestors.isEnabled()))
            .forEach((n) => n.disable());
    }
    enableAll() {
        this.nodes.filter((n) => !n.isEnabled() && !this._config.noStart.includes(n.getName())).forEach((n) => n.enable());
    }
    getProjectRoot() {
        return this.projectRoot;
    }
    getServices() {
        return this.nodes.filter((n) => n.isService());
    }
    getPackages() {
        return this.nodes.filter((n) => !n.isService());
    }
    getNodes() {
        return this.nodes;
    }
    get(name) {
        return this.nodes.find((n) => n.getName() === name);
    }
}
exports.DependenciesGraph = DependenciesGraph;
//# sourceMappingURL=dependencies-graph.js.map