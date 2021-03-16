/**
 * Package microservice (using yarn workspace focus) on memfs
 */
import { Packager, Service } from "@microlambda/core";
import chalk from "chalk";
import { ILogger, ServerlessInstance } from "../../types";
import { assign } from "../../utils";
import { join } from "path";
import { existsSync } from "fs";

export const packageService = (
  serverless: ServerlessInstance,
  service: Service | undefined,
  logger?: ILogger
): Promise<void> => {
  if (!service) {
    throw new Error("Assertion failed: service not resolved");
  }
  const bundleLocation = join(service.getLocation(), ".package", "bundle.zip");
  const setArtifact = (): void => {
    assign(serverless, "service.package.artifact", bundleLocation);
  };

  return new Promise((resolve, reject) => {
    if (existsSync(bundleLocation)) {
      logger?.info(
        "[package] Using Artifact already existing @",
        bundleLocation
      );
      setArtifact();
      return resolve();
    }
    // Find all service's internal dependencies
    const packager = new Packager();
    packager.bundle(service.getName(), 4).subscribe(
      (evt) => {
        logger?.info(`[package] ${evt.message} (took ${evt.took}ms)`);
        if (evt.megabytes) {
          logger?.info(
            `[package] Zip file generated in ${(0.5 * evt.overall).toFixed(
              2
            )}s - ${chalk.magenta(evt.megabytes + "MB")}`
          );
        }
      },
      (err) => {
        logger?.error("Error happen during packaging process");
        logger?.error(err);
        return reject(err);
      },
      () => {
        setArtifact();
        return resolve();
      }
    );
  });
};
