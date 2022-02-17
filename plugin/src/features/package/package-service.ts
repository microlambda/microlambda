/**
 * Package microservice (using yarn workspace focus) on memfs
 */
import { Packager, Workspace } from "@microlambda/core";
import chalk from "chalk";
import { ILogger, ServerlessInstance } from "../../types";
import { assign } from "../../utils";
import { join, resolve as pathResolve } from "path";
import { existsSync } from "fs";
import { watch } from "chokidar";
import { readJSONSync } from "fs-extra";
import {IPluginConfig} from "../../config";
import {calculateLayerChecksums} from "../../aws/parameter-store/calculate-layer-checksums";
import {readLayerChecksums} from "../../aws/parameter-store/read-layer-checksums";
import {compareLayerChecksums} from "../../aws/parameter-store/compare-layer-checksums";
import {publishLayer} from "../../aws/lambda/publish-layer";
import {writeLayerChecksums} from "../../aws/parameter-store/write-layer-checksums";
import {ILayerChecksums} from "../../aws/parameter-store/layer-checksums";
import {pruneLayers} from "../../aws/lambda/prune-layers";

const DEFAULT_LEVEL = 4;

export const packageService = (
  serverless: ServerlessInstance,
  stackName: string,
  config: IPluginConfig | undefined,
  service: Workspace | undefined,
  logger?: ILogger
): Promise<void> => {
  if (!service) {
    throw new Error("Assertion failed: service not resolved");
  }
  const useLayer = config?.packagr?.useLayer === true;
  const useLayerChecksums = config?.packagr?.checksums;

  const bundleLocation = join(service.root, ".package", "bundle.zip");
  const layerLocation = join(service.root, ".package", "layer.zip");

  const bundleMetadataLocation = join(
    service.root,
    ".package",
    "bundle-metadata.json"
  );
  const isPackaging = existsSync(
    join(service.root, ".package", "tmp")
  );
  const isPackaged = useLayer ? existsSync(bundleMetadataLocation) && existsSync(bundleLocation) && existsSync(layerLocation) : existsSync(bundleMetadataLocation) && existsSync(bundleLocation);

  const setArtifact = (): void => {
    assign(serverless, "service.package.artifact", bundleLocation);
  };

  const setLayer = (layerArn: string): void => {
    assign(serverless, "service.provider.layers", [layerArn]);
  };

  return new Promise(async (resolve, reject) => {
    // In multi-region deployment scenario, region are deployed concurrently
    // If a deployment for a region already launched a packaging process, we wait for it to finish and resolve
    const FIVE_MINUTES = 5 * 60 * 1000;
    const timeoutCatcher = setTimeout(() => {
      logger?.error("[package] Packaging timed out");
      return reject();
    }, FIVE_MINUTES);

    const afterPackaged = async (shouldBuildLayer: boolean, currentChecksums?: ILayerChecksums | null): Promise<void> => {
      setArtifact();
      clearTimeout(timeoutCatcher);
      if (useLayer && shouldBuildLayer) {
        let layerArn: string | undefined;
        try {
          layerArn = await publishLayer(layerLocation, stackName, serverless, config?.packagr);
        } catch (e) {
          logger?.error('Error publishing layer');
          logger?.error('Original error', e);
          throw e;
        }
        if (layerArn) {
          logger?.info('Layer version published', layerArn);
          setLayer(layerArn);
          if (useLayerChecksums && currentChecksums) {
            logger?.info('Writing checksums', layerArn);
            await writeLayerChecksums(useLayerChecksums.bucket, useLayerChecksums.key, currentChecksums, serverless.providers.aws.getRegion(), logger)
          }
          if (config?.packagr?.prune) {
            await pruneLayers(config?.packagr?.prune, stackName, serverless.providers.aws.getRegion(), logger);
          }
        } else {
          logger?.error('Layer version ARN could not be resolved')
          throw new Error('Layer version ARN could not be resolved');
        }
      }
    }

    const printMetadata = (): void => {
      const metadata: { took: number; megabytes: { code: number, layer?: number} } = readJSONSync(
          bundleMetadataLocation
      );
      logger?.info(
          `[package] Zip file generated in ${(0.5 * metadata.took).toFixed(
              2
          )}s - ${chalk.magenta(metadata.megabytes.code + "MB")}`
      );
      if (metadata.megabytes.layer) {
        logger?.info(
            `[package] Using layer for node_modules ${chalk.magenta(metadata.megabytes.layer + "MB")}`
        );
      }
    }

    let shouldBuildLayer = useLayer;
    let currentChecksums: ILayerChecksums | undefined | null;
    if (useLayerChecksums) {
      logger?.info('[package] Calculating checksums');
      currentChecksums = await calculateLayerChecksums(
          service,
          logger
      );
      logger?.info('[package] Fetching upstream checksums');
      const readChecksums = await readLayerChecksums(useLayerChecksums.bucket, useLayerChecksums.key, serverless.providers.aws.getRegion(), logger);

      logger?.debug('[package] Upstream checksums', currentChecksums);
      logger?.debug('[package] Current checksums', currentChecksums);
      shouldBuildLayer = !(await compareLayerChecksums(currentChecksums, readChecksums));
      logger?.info('[package] Should re-build layer', shouldBuildLayer);
    }

    if (isPackaged) {
      logger?.info("[package] Already packaged. Using existing bundle.zip");
      if (useLayer) {
        logger?.info("[package] Layer already create. Using existing layer.zip");
      }
      printMetadata();
      afterPackaged(shouldBuildLayer, currentChecksums).then(resolve).catch(reject);
    } else if (isPackaging) {
      logger?.info("[package] A packaging process is already running");
      logger?.debug(
        "[package] Watching",
        join(service.root, ".package")
      );
      const watcher = watch(join(service.root, ".package"));
      watcher.on("add", (path) => {
        if (pathResolve(path) === pathResolve(bundleMetadataLocation)) {
          logger?.info("[package] External packaging process succeeded");
          logger?.info("[package] Bundle has been created by other process");
          printMetadata();
          afterPackaged(shouldBuildLayer, currentChecksums).then(resolve).catch(reject);
        }
      });
    } else {
      const packager = new Packager(useLayer, shouldBuildLayer);
      packager.bundle(service.name, config?.packagr?.level || DEFAULT_LEVEL).subscribe(
        (evt) => {
          logger?.info(`[package] ${evt.message} (took ${evt.took}ms)`);
          if (evt.megabytes?.code) {
            logger?.info(
                `[package] Zip file generated in ${(0.5 * evt.overall).toFixed(
                    2
                )}s - ${chalk.magenta(evt.megabytes.code + "MB")}`
            );
          }
          if (evt.megabytes?.layer) {
            logger?.info(
                `[package] Using layer for node_modules ${chalk.magenta(evt.megabytes.layer + "MB")}`
            );
          }
        },
        (err) => {
          logger?.error("Error happen during packaging process");
          logger?.error(err);
          clearTimeout(timeoutCatcher);
          return reject(err);
        },
        () => {
          afterPackaged(shouldBuildLayer, currentChecksums).then(resolve).catch(reject);
        }
      );
    }
  });
};
