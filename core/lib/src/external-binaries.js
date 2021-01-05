"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyBinaries = exports.getBinary = void 0;
const path_1 = require("path");
const fs_1 = require("fs");
const child_process_1 = require("child_process");
const versions = new Map();
const getVersion = (binary) => {
    if (versions.has(binary)) {
        return versions.get(binary);
    }
    const version = child_process_1.execSync(binary + ' --version')
        .toString()
        .match(/[0-9]+\.[0-9]+\.[0-9]+/)[0];
    versions.set(binary, version);
    return version;
};
exports.getBinary = (cmd, projectRoot, logger, node) => {
    const cmdPath = ['node_modules', '.bin', cmd];
    const projectBinary = path_1.join(projectRoot, ...cmdPath);
    if (!node) {
        return projectBinary;
    }
    const localBinary = path_1.join(node.getLocation(), ...cmdPath);
    const hasLocal = fs_1.existsSync(localBinary);
    const binary = hasLocal ? localBinary : projectBinary;
    logger.log('binaries').debug(`Using ${hasLocal ? 'local' : 'project'} ${cmd}`, getVersion(binary));
    logger.log('binaries').debug('Path to binary', hasLocal ? localBinary : projectBinary);
    return binary;
};
const testBinary = (cmd, projectRoot, logger) => {
    return fs_1.existsSync(exports.getBinary(cmd, projectRoot, logger));
};
const installBinary = async (deps, projectRoot) => {
    const process = child_process_1.spawn('npm', ['i', '-D', ...deps], {
        cwd: projectRoot,
        stdio: 'inherit',
    });
    return new Promise((resolve, reject) => {
        process.on('close', (code) => {
            if (code === 0) {
                return resolve();
            }
            return reject();
        });
        process.on('error', (err) => reject(err));
    });
};
exports.verifyBinaries = async (mode, projectRoot, logger) => {
    const binaryPackages = new Map();
    binaryPackages.set('lerna', ['lerna']);
    binaryPackages.set('tsc', ['typescript']);
    binaryPackages.set('sls', ['serverless']);
    const binariesToTest = ['tsc', 'sls'];
    const deps = [];
    for (const cmd of binariesToTest) {
        if (!testBinary(cmd, projectRoot, logger)) {
            const packagesToInstall = binaryPackages.get(cmd);
            packagesToInstall.forEach((pkg) => {
                logger.log('binaries').warn(`Missing peer dependency ${pkg}`);
                deps.push(pkg);
            });
        }
    }
    if (deps.length > 0) {
        logger.log('binaries').info('Installing missing peer dependencies');
        await installBinary(deps, projectRoot);
    }
};
//# sourceMappingURL=external-binaries.js.map