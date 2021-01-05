"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProjectRoot = exports.findProjectRoot = void 0;
const tslib_1 = require("tslib");
const path_1 = require("path");
const fs_1 = require("fs");
const chalk_1 = tslib_1.__importDefault(require("chalk"));
const errors_1 = require("./errors");
exports.findProjectRoot = () => {
    const root = path_1.parse(process.cwd()).root;
    const recursivelyFind = (path) => {
        if (path === root) {
            throw new errors_1.MilaError(errors_1.MilaErrorCode.NOT_IN_A_VALID_LERNA_PROJECT);
        }
        if (fs_1.existsSync(path_1.join(path, '.microlambdarc'))) {
            return path;
        }
        else {
            return recursivelyFind(path_1.join(path, '..'));
        }
    };
    return recursivelyFind(process.cwd());
};
exports.getProjectRoot = (logger) => {
    try {
        return exports.findProjectRoot();
    }
    catch (e) {
        logger.log('project-root').error('Cannot find project root. Make sure it is a valid lerna project.');
        logger.log('project-root').error(e);
        if (e instanceof errors_1.MilaError) {
            console.error(chalk_1.default.red(e.message));
        }
        else {
            console.error(chalk_1.default.red('Cannot find project root'));
            console.error(chalk_1.default.red(e));
        }
        process.exit(1);
    }
};
//# sourceMappingURL=get-project-root.js.map