import { assign } from "../../utils";
import { relative } from "path";
import { watchFiles } from "./watch";
import { Service } from "@microlambda/core";
import { transpile } from "./compile";
import { ILogger, ServerlessInstance } from "../../types";
import { resolveOutDir } from "./resolve-out-dir";

export const beforeOffline = async (
  serverless: ServerlessInstance,
  service: Service | undefined,
  logger?: ILogger
): Promise<void> => {
  if (!service) {
    throw new Error("Assertion failed: service not resolved");
  }
  await transpile(service, logger);
  assign(
    serverless,
    "service.custom.serverless-offline.location",
    relative(process.cwd(), resolveOutDir(service, logger) || "lib")
  );
  watchFiles(service, logger);
};
