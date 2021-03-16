/**
 * Package microservice (using yarn workspace focus) on memfs
 */
import { Packager, Service } from "@microlambda/core";
import chalk from "chalk";
import { ILogger, ServerlessInstance } from "../../types";
import { assign } from "../../utils";
import { join, resolve as pathResolve } from "path";
import { existsSync } from "fs";
import { watch } from "chokidar";

export const packageService = (
  serverless: ServerlessInstance,
  service: Service | undefined,
  logger?: ILogger
): Promise<void> => {
  if (!service) {
    throw new Error("Assertion failed: service not resolved");
  }
  const isPackaging = existsSync(
    join(service.getLocation(), ".package", "tmp")
  );
  const bundleLocation = join(service.getLocation(), ".package", "bundle.zip");
  const setArtifact = (): void => {
    assign(serverless, "service.package.artifact", bundleLocation);
  };

  return new Promise((resolve, reject) => {
    // In multi-region deployment scenario, region are deployed concurrently
    // If a deployment for a region already launched a packaging process, we wait for it to finish and resolve
    const FIVE_MINUTES = 5 * 60 * 1000;
    setTimeout(() => {
      logger?.error("[package] Packaging timed out");
      return reject();
    }, FIVE_MINUTES);
    if (isPackaging) {
      logger?.info("[package] A packaging process is already running");
      logger?.debug(
        "[package] Watching",
        join(service.getLocation(), ".package")
      );
      const watcher = watch(join(service.getLocation(), ".package"));
      watcher.on("add", (path) => {
        if (pathResolve(path) === pathResolve(bundleLocation)) {
          logger?.info("[package] Bundle has been created by other process");
          setArtifact();
          return resolve();
        }
      });
    } else {
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
    }
  });
};
