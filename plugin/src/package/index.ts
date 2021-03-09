/**
 * Package microservice (using yarn workspace focus) on memfs
 */
import { Packager, Service } from "@microlambda/core";
import { IPluginLogger } from "../utils/logger";
import chalk from "chalk";
import { ServerlessInstance } from "../types";
import { assign } from "../utils/assign";
import { join } from "path";

export const packageService = (
  serverless: ServerlessInstance,
  service: Service | undefined,
  logger?: IPluginLogger
): Promise<void> => {
  if (!service) {
    throw new Error("Assertion failed: service not resolved");
  }
  return new Promise((resolve, reject) => {
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
        assign(
          serverless,
          "service.package.artifact",
          join(service.getLocation(), ".package", "bundle.zip")
        );
        return resolve();
      }
    );
  });
};
