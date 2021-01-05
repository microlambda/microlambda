"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGraphFromYarnProject = exports.getName = exports.getYarnProject = void 0;
const core_1 = require("@yarnpkg/core");
const path_1 = require("@yarnpkg/fslib/lib/path");
const cli_1 = require("@yarnpkg/cli");
const graph_1 = require("../graph");
exports.getYarnProject = async (projectRoot) => {
    const rootPath = path_1.convertPath(path_1.ppath, projectRoot);
    const plugins = cli_1.getPluginConfiguration();
    const configuration = await core_1.Configuration.find(rootPath, plugins);
    const mainWorkspace = await cli_1.openWorkspace(configuration, rootPath);
    return mainWorkspace.project;
};
exports.getName = (entity) => {
    const buildName = (desc) => {
        return desc.scope ? ['@' + desc.scope, desc.name].join('/') : desc.name;
    };
    if (entity instanceof core_1.Workspace) {
        return buildName(entity.manifest.name);
    }
    return buildName(entity);
};
exports.getGraphFromYarnProject = async (projectRoot, scheduler, config, logger, defaultPort = 3001) => {
    const project = await exports.getYarnProject(projectRoot);
    return new graph_1.DependenciesGraph(scheduler, project, config, logger, defaultPort);
};
//# sourceMappingURL=project.js.map