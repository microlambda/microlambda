/**
 * Package microservice (using yarn workspace focus) on memfs
 */
import { Packager, Workspace } from "@microlambda/core";
import chalk from "chalk";
import { IBaseLogger, ServerlessInstance, IPluginConfig } from "@microlambda/types";
import { assign } from "../../utils";
import { join } from "path";
import { existsSync, rmSync } from 'fs';
import { readJSONSync } from "fs-extra";
import { aws } from '@microlambda/aws';
import { shouldRecreateLayer, writeLayerChecksums } from '@microlambda/layers';
import { checkPackageIntegrity } from './check-package-integrity';
import { ISourcesChecksums } from '@microlambda/runner-core';
import { ConfigReader } from '@microlambda/config';

const DEFAULT_LEVEL = 4;

export const packageService = async (
  serverless: ServerlessInstance,
  stackName: string,
  config: IPluginConfig | undefined,
  service: Workspace | undefined,
  logger?: IBaseLogger
): Promise<void> => {
  if (!service) {
    throw new Error("Assertion failed: service not resolved");
  }
  const useLayer = config?.packagr?.useLayer === true;
  const useLayerChecksums = config?.packagr?.checksums;
  const env = serverless.service.provider.stage;
  if (!service.project) {
    throw new Error('Assertion failed: project root should have resolved');
  }
  const rootConfig = new ConfigReader(service.project.root).rootConfig;
  const bundleLocation = join(service.root, ".package", "bundle.zip");
  const layerLocation = join(service.root, ".package", "layer.zip");

  logger?.info('[package] Generating bundle.zip at', bundleLocation);
  logger?.info('[package] Using layer', useLayer);
  logger?.info('[package] Using layer caching', useLayerChecksums);

  let shouldRepackage = true;
  if (existsSync(bundleLocation)) {
    logger?.info('[package] Checking previous bundle.zip integrity')
    const isPackageValid  = await checkPackageIntegrity(service, logger);
    shouldRepackage = !isPackageValid;
    logger?.info('[package] Should repackage', shouldRepackage);
  } else {
    logger?.info('[package] No previous bundle.zip found, repackaging...')
  }

  const bundleMetadataLocation = join(
    service.root,
    ".package",
    "bundle-metadata.json"
  );

  const setArtifact = (): void => {
    assign(serverless, "service.package.artifact", bundleLocation);
  };

  const setLayer = (layerArn: string): void => {
    assign(serverless, "service.provider.layers", [layerArn]);
  };

  return new Promise(async (resolve, reject) => {
    const afterPackaged = async (shouldBuildLayer: boolean, currentChecksums?: ISourcesChecksums | null): Promise<void> => {
      setArtifact();
      if (useLayer && shouldBuildLayer) {
        let layerArn: string | undefined;
        try {
          layerArn = await aws.lambda.publishLayer(layerLocation, stackName, serverless, config?.packagr);
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
            await writeLayerChecksums(
              service,
              env,
              rootConfig,
              currentChecksums,
              logger,
            )
          }
          if (config?.packagr?.prune) {
            await aws.lambda.pruneLayers(config?.packagr?.prune, stackName, serverless.providers.aws.getRegion(), logger);
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
          )}s - ${chalk.magenta(metadata.megabytes.code || metadata.megabytes + "MB")}`
      );
      if (metadata.megabytes.layer) {
        logger?.info(
            `[package] Using layer for node_modules ${chalk.magenta(metadata.megabytes.layer + "MB")}`
        );
      }
    }

    let shouldRedeployLayer = true;
    let currentChecksums: ISourcesChecksums | undefined | null;

    if (useLayerChecksums) {
      const shouldRebuildLayer = await shouldRecreateLayer(service, env, rootConfig, logger);
      currentChecksums = shouldRebuildLayer.currentChecksums;
      shouldRedeployLayer = shouldRebuildLayer.recreate;
    }
    if (!shouldRepackage) {
      logger?.info("[package] Existing bundle.zip up-to-date, using it.");
      if (useLayer) {
        logger?.info("[package] Layer already created. Using existing layer.zip");
      }
      printMetadata();
      afterPackaged(shouldRedeployLayer, currentChecksums).then(resolve).catch(reject);
    } else {
      logger?.info("[package] Cleaning previous packaging artifacts");
      if (existsSync(join(service.root, '.package'))) {
        rmSync(join(service.root, '.package'), { recursive: true, force: true });
      }
      logger?.info("[package] Packaging service...");
      const packager = new Packager(useLayer, shouldRedeployLayer);
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
          return reject(err);
        },
        () => {
          afterPackaged(shouldRedeployLayer, currentChecksums).then(resolve).catch(reject);
        }
      );
    }
  });
};
