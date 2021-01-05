"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tailLogs = exports.createLogFile = exports.recreateLogDirectory = exports.getLogsPath = exports.getLogsDirectory = void 0;
const tslib_1 = require("tslib");
const fs_1 = require("fs");
const rimraf_1 = tslib_1.__importDefault(require("rimraf"));
const path_1 = require("path");
const child_process_1 = require("child_process");
exports.getLogsDirectory = (projectRoot) => path_1.join(projectRoot, '.mila', 'logs');
exports.getLogsPath = (projectRoot, service, type) => {
    const segments = service.split('/');
    const name = segments[segments.length - 1];
    return path_1.join(exports.getLogsDirectory(projectRoot), `${name}.${type}.log`);
};
exports.recreateLogDirectory = (projectRoot, logger) => {
    const logsDirectory = exports.getLogsDirectory(projectRoot);
    if (!fs_1.existsSync(logsDirectory)) {
        fs_1.mkdirSync(logsDirectory, { recursive: true });
        return;
    }
    if (!fs_1.lstatSync(logsDirectory).isDirectory()) {
        logger.log('logs').error(`${logsDirectory} is not a directory`);
        process.exit(1);
    }
    rimraf_1.default.sync(logsDirectory);
    fs_1.mkdirSync(logsDirectory);
};
exports.createLogFile = (projectRoot, service, type) => {
    const logsPath = exports.getLogsPath(projectRoot, service, type);
    if (!fs_1.existsSync(path_1.dirname(logsPath))) {
        fs_1.mkdirSync(path_1.dirname(logsPath), { recursive: true });
    }
    if (!fs_1.existsSync(logsPath)) {
        fs_1.closeSync(fs_1.openSync(logsPath, 'w'));
    }
};
exports.tailLogs = (serviceName, projectRoot, logger) => {
    const logsDirectory = exports.getLogsDirectory(projectRoot);
    fs_1.stat(`${logsDirectory}/${serviceName}.log`, (exists) => {
        if (exists === null) {
            child_process_1.spawnSync('tail', ['-n', '+1', `${logsDirectory}/${serviceName}.log`], { stdio: 'inherit' });
        }
        else {
            logger
                .log('logs')
                .error(`There is not logs for the ${serviceName} service or the service specified does not exist.\n\tPlease run 'mila start' command first!`);
        }
    });
};
//# sourceMappingURL=logs.js.map