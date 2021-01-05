"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Packager = void 0;
const tslib_1 = require("tslib");
const path_1 = require("path");
const execa_1 = require("execa");
const fs_extra_1 = require("fs-extra");
const fs_1 = require("fs");
const archiver_1 = tslib_1.__importDefault(require("archiver"));
const chalk_1 = tslib_1.__importDefault(require("chalk"));
const glob_1 = require("glob");
class Packager {
    constructor(graph, services, logger) {
        this._services = Array.isArray(services) ? services : [services];
        this._tree = new Map();
        this._shaken = new Map();
        this._logger = logger.log('packagr');
        this._graph = graph;
    }
    getTree(serviceName) {
        return this._tree.get(serviceName);
    }
    setTree(serviceName, tree) {
        this._tree.set(serviceName, tree);
    }
    async bundle(restore = true, level = 4, stdio = 'ignore') {
        await Promise.all(this._services.map((service) => this.generateZip(service, level, restore, stdio)));
    }
    async generateZip(service, level, restore, stdio) {
        this._logger.info(`${chalk_1.default.bold(service.getName())}: re-installing only workspace production dependencies with yarn`);
        await execa_1.command(`yarn workspaces focus ${service.getName()} --production`, { stdio });
        const projectRoot = this._graph.project.cwd;
        const packageDirectory = path_1.join(service.getLocation(), '.package');
        if (fs_extra_1.existsSync(packageDirectory)) {
            fs_extra_1.removeSync(packageDirectory);
        }
        fs_extra_1.mkdirSync(packageDirectory);
        const megabytes = await new Promise((resolve, reject) => {
            const zipName = 'bundle.zip';
            const output = fs_1.createWriteStream(path_1.join(packageDirectory, zipName));
            const archive = archiver_1.default('zip', {
                zlib: { level },
            });
            output.on('close', () => {
                const megabytes = Math.round(100 * (archive.pointer() / 1000000)) / 100;
                this._logger.info(`${chalk_1.default.bold(service.getName())}: Zip files successfully created (${megabytes}MB)`);
                return resolve(megabytes);
            });
            archive.on('warning', (err) => {
                if (err.code === 'ENOENT') {
                    this._logger.warn(err);
                }
                else {
                    this._logger.error(err);
                    return reject(err);
                }
            });
            archive.on('error', (err) => {
                this._logger.error(err);
                return reject(err);
            });
            archive.pipe(output);
            const lib = path_1.join(service.getLocation(), 'lib');
            const toZip = new Map();
            const dependencies = glob_1.sync(path_1.join(projectRoot, 'node_modules', '**', '*'), { follow: true });
            dependencies.forEach((path) => {
                toZip.set(path_1.relative(projectRoot, path), path);
            });
            const compiledSources = glob_1.sync(path_1.join(lib, '**', '*.js'));
            compiledSources.forEach((js) => {
                toZip.set(path_1.relative(lib, js), js);
            });
            toZip.forEach((from, dest) => {
                const stats = fs_extra_1.statSync(from);
                if (stats.isFile()) {
                    archive.file(from, {
                        name: dest,
                        mode: 0o644,
                    });
                }
            });
            archive.finalize();
        });
        if (restore) {
            await execa_1.command('yarn install', { stdio });
        }
        return megabytes;
    }
    print(service, printDuplicates = false) {
        if (!this._tree) {
            this._logger.debug(this._tree);
        }
        let printable = '';
        const roots = this._tree.get(service.getName()).filter((p) => p.parent == null);
        const printLevel = (packages, depth = 0) => {
            for (const pkg of packages) {
                if (printDuplicates || !pkg.duplicate) {
                    printable += `${'-'.repeat(depth)}${pkg.name}@${pkg.version} [${pkg.local ? chalk_1.default.blue('local') : chalk_1.default.yellow('remote')}] ${pkg.duplicate ? chalk_1.default.red('dedup') : ''}\n`;
                }
                printLevel(pkg.children, depth + 1);
            }
        };
        printLevel(roots);
        return printable;
    }
}
exports.Packager = Packager;
//# sourceMappingURL=packagr.js.map