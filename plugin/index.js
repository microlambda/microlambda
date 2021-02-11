"use strict";
const tslib_1 = require("tslib");
const core_1 = require("@microlambda/core");
class ServerlessMilaOffline {
    constructor(serverless, options) {
        this.serverless = serverless;
        this.options = options;
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
        });
    }
    _getDependenciesGraph() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const projectRoot = core_1.getProjectRoot();
            this.serverless.cli.log(`Project root resolved ${projectRoot}`);
            this._config = new core_1.ConfigReader().readConfig();
            this._graph = yield core_1.getGraphFromYarnProject(projectRoot, this._config);
            this.serverless.cli.log(`Dependencies graph resolved: this._graph.getNodes().length nodes`);
        });
    }
    _transpile() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
        });
    }
}
module.exports = ServerlessMilaOffline;
//# sourceMappingURL=index.js.map