import { getTsConfig, Workspace } from "@microlambda/core";
import { watch } from "chokidar";
import { ILogger } from "../../types";
import { transpile } from "./compile";

export const watchFiles = (service: Workspace, logger?: ILogger): void => {
  const files: string[] = [];
  if (!service) {
    logger?.error(`Cannot watch: service not resolved`);
    return;
  }
  for (const dep of new Set([...service.dependencies(), service])) {
    const tscConfig = getTsConfig(dep.root);
    files.push(...tscConfig.fileNames);
  }
  files.forEach((f) => logger?.debug(`Watching ${f}`));
  const ignoreFistAdd = new Set();
  watch(files).on("all", async (event, path) => {
    if (event === "add" && !ignoreFistAdd.has(path)) {
      ignoreFistAdd.add(path);
      return;
    }
    logger?.info(`${path} changed [${event}] - Recompiling...`);
    await transpile(service, logger);
  });
};
