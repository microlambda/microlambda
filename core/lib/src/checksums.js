"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checksums = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
const typescript_1 = require("./typescript");
const hasha_1 = require("hasha");
exports.checksums = (node, logger) => {
    const projectRoot = node.getGraph().getProjectRoot();
    const hashesDir = path_1.join(projectRoot, '.mila', 'hashes');
    const segments = node.getName().split('/');
    const hashPath = path_1.join(hashesDir, segments[segments.length - 1]);
    const ensureDestExists = () => {
        if (!fs_1.existsSync(hashesDir)) {
            fs_1.mkdirSync(hashesDir, { recursive: true });
        }
    };
    return {
        calculate: async () => {
            const hashes = {};
            const calculateForNode = async (n) => {
                const config = typescript_1.getTsConfig(n.getLocation());
                const sources = config ? config.fileNames : [];
                await Promise.all(sources.map(async (src) => {
                    hashes[src] = await hasha_1.fromFile(src, { algorithm: 'sha256' });
                }));
            };
            const dependencies = [node, ...node.getDependencies()];
            await Promise.all(dependencies.map((n) => calculateForNode(n)));
            logger.log('checksum').debug(`Calculated checksum for ${node.getName()}`, hashes);
            return hashes;
        },
        read: async () => {
            if (!fs_1.existsSync(hashPath)) {
                logger.log('checksum').debug('cannot read, path does not exist');
                return null;
            }
            return new Promise((resolve, reject) => {
                fs_1.readFile(hashPath, (err, data) => {
                    if (err) {
                        logger.log('checksum').debug('cannot read', err);
                        return reject(err);
                    }
                    try {
                        const hashes = JSON.parse(data.toString());
                        logger.log('checksum').debug(`Read checksum for ${node.getName()}`, hashes);
                        return resolve(hashes);
                    }
                    catch (e) {
                        logger.log('checksum').debug('cannot parse', e);
                        return reject(e);
                    }
                });
            });
        },
        compare: (old, current) => {
            logger.log('checksum').debug(`Comparing checksums for ${node.getName()}`, { old, current });
            if (!old) {
                return true;
            }
            const keys = {
                old: Object.keys(old),
                current: Object.keys(current),
            };
            if (keys.old.length !== keys.current.length) {
                logger.log('checksum').debug('Different # keys');
                return true;
            }
            for (const key of keys.current) {
                if (!keys.old.includes(key)) {
                    logger.log('checksum').debug('New key');
                    return true;
                }
                if (old[key] !== current[key]) {
                    logger.log('checksum').debug('New value');
                    return true;
                }
            }
            logger.log('checksum').debug('Same hashes');
            return false;
        },
        write: async (data) => {
            ensureDestExists();
            return new Promise((resolve, reject) => {
                fs_1.writeFile(hashPath, JSON.stringify(data), { encoding: 'utf-8', flag: 'w' }, (err) => {
                    if (err) {
                        logger.log('checksum').error(err);
                        return reject(err);
                    }
                    return resolve();
                });
            });
        },
    };
};
//# sourceMappingURL=checksums.js.map