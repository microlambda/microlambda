"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getThreads = exports.getDefaultThreads = void 0;
const tslib_1 = require("tslib");
const os_1 = tslib_1.__importDefault(require("os"));
const cpuCount = os_1.default.cpus().length;
exports.getDefaultThreads = () => {
    return Math.floor(cpuCount / 2);
};
exports.getThreads = (target) => {
    if (target < 0 || !Number.isInteger(target)) {
        throw Error('Number of threads must be a strictly positive integer');
    }
    if (target > cpuCount) {
        return cpuCount;
    }
    return target;
};
//# sourceMappingURL=platform.js.map