import {ILayerChecksums} from "./layer-checksums";
import {ILogger} from "../../types";
import { fromFile } from 'hasha';
import {getTsConfig, Workspace} from "@microlambda/core";
import {join, relative} from 'path';
import {sync as glob} from "glob";

export const calculateLayerChecksums = async (service: Workspace, logger?: ILogger): Promise<ILayerChecksums | null> => {
    try {
        const projectRoot = service.getGraph().getProjectRoot();
        const manifestPath = join(service.getLocation(), 'package.json');
        const lockPath = join(projectRoot, 'yarn.lock');
        const internalDependenciesSources = service.getDependencies().map((node) => {
            const tsConfig = getTsConfig(node.getLocation());
            const lib = tsConfig?.options?.outDir;
            const compiledSources = lib ? glob(join(lib, '**', '*.js')): [];
            const dependencyManifest = join(node.getLocation(), 'package.json');
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
