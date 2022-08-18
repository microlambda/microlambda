import {ILayerChecksums} from "./layer-checksums";
import { IBaseLogger } from "@microlambda/types";
import { fromFile } from 'hasha';
import {getTsConfig, Workspace} from "@microlambda/core";
import {join, relative} from 'path';
import {sync as glob} from "glob";
import {resolveProjectRoot} from "@microlambda/runner-core";

export const calculateLayerChecksums = async (service: Workspace, logger?: IBaseLogger): Promise<ILayerChecksums | null> => {
    try {
        const projectRoot = resolveProjectRoot();
        const manifestPath = join(service.root, 'package.json');
        const lockPath = join(projectRoot, 'yarn.lock');
        const internalDependenciesSources = Array.from(service.dependencies()).map((node) => {
            const tsConfig = getTsConfig(node.root);
            const lib = tsConfig?.options?.outDir;
            const compiledSources = lib ? glob(join(lib, '**', '*.js')): [];
            const dependencyManifest = join(node.root, 'package.json');
            return [...compiledSources, dependencyManifest];
        }).reduce((acc, val) => acc.concat(val), []);
        const toWatch = [manifestPath, lockPath, ...internalDependenciesSources];
        const checksums: ILayerChecksums = {};
        const calculateChecksumPromises: Array<Promise<void>> = [];
        for (const file of toWatch) {
            const filePath = relative(projectRoot, file);
            const addToChecksums = new Promise<void>((resolve) => {
                fromFile(file, { algorithm: 'sha256'}).then((sha) => {
                    checksums[filePath] = sha;
                    return resolve();
                })
            });
            calculateChecksumPromises.push(addToChecksums)
        }
        await Promise.all(calculateChecksumPromises);
        return checksums;
    } catch (e) {
        logger?.warn('Could not calculate checksums', e);
        return null;
    }
};
