import { assign } from "../../utils";
import { relative } from "path";
import { watchFiles } from "./watch";
import { Workspace } from "@microlambda/core";
import { transpile } from "./compile";
import { IBaseLogger, ServerlessInstance } from "@microlambda/types";
import { resolveOutDir } from "./resolve-out-dir";
import { injectLocalEnvironmentVariables } from '../environments/before-start';

export const beforeOffline = async (
  serverless: ServerlessInstance,
  service: Workspace | undefined,
  logger?: IBaseLogger
): Promise<void> => {
  if (!service) {
    throw new Error("Assertion failed: service not resolved");
  }
  await injectLocalEnvironmentVariables(service, logger);
  await transpile(service, logger);
  assign(
    serverless,
    "service.custom.serverless-offline.location",
    relative(process.cwd(), resolveOutDir(service, logger) || "lib")
  );
  watchFiles(service, logger);
};
