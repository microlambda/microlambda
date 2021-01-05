"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compileFiles = exports.compileFile = exports.getTsConfig = void 0;
const typescript_1 = require("typescript");
const fs_1 = require("fs");
const path_1 = require("path");
exports.getTsConfig = (cwd) => {
    const parseConfigHost = {
        fileExists: typescript_1.sys.fileExists,
        readFile: typescript_1.sys.readFile,
        readDirectory: typescript_1.sys.readDirectory,
        useCaseSensitiveFileNames: true,
    };
    const configFileName = typescript_1.findConfigFile(cwd, typescript_1.sys.fileExists, 'tsconfig.json');
    const configFile = typescript_1.readConfigFile(configFileName, typescript_1.sys.readFile);
    return typescript_1.parseJsonConfigFileContent(configFile.config, parseConfigHost, cwd);
};
const copyFile = async (dest, data, logger) => {
    return new Promise((resolve, reject) => {
        const folder = path_1.dirname(dest);
        fs_1.access(dest, fs_1.constants.F_OK, (err) => {
            if (err && err.code === 'ENOENT') {
                fs_1.mkdir(folder, { recursive: true }, (err) => {
                    if (err) {
                        logger.log('ts').error('Error making target folder', folder);
                        logger.log('ts').error(err);
                        return reject(err);
                    }
                    fs_1.writeFile(dest, data, (err) => {
                        if (err) {
                            logger.log('ts').error('Error write target file', dest);
                            logger.log('ts').error(err);
                            return reject(err);
                        }
                        return resolve();
                    });
                });
            }
            else if (err) {
                logger.log('ts').error('Error checking existence of target folder', folder);
                logger.log('ts').error(err);
                return reject(err);
            }
            else {
                fs_1.writeFile(dest, data, (err) => {
                    if (err) {
                        logger.log('ts').error('Error write target file', dest);
                        logger.log('ts').error(err);
                        return reject(err);
                    }
                    return resolve();
                });
            }
        });
    });
};
exports.compileFile = (cwd, absolutePath, compilerOptions, logger) => {
    return new Promise((resolve, reject) => {
        fs_1.readFile(absolutePath, (err, buffer) => {
            if (err) {
                logger.log('ts').error(err);
                return reject(err);
            }
            const outDir = compilerOptions.outDir || path_1.join(cwd, 'lib');
            const js = typescript_1.transpileModule(buffer.toString(), { compilerOptions });
            const dest = path_1.join(outDir, path_1.relative(cwd, absolutePath.replace(/\.ts$/, '.js')));
            copyFile(dest, js.outputText, logger)
                .then(resolve)
                .catch(reject);
        });
    });
};
exports.compileFiles = async (cwd, logger) => {
    logger.log('ts').debug('compiling files in directory', cwd);
    const config = exports.getTsConfig(cwd);
    logger.log('ts').debug('config read', config);
    const fileNames = config.fileNames;
    await Promise.all(fileNames.map((file) => exports.compileFile(cwd, file, config.options, logger)));
};
//# sourceMappingURL=typescript.js.map