"use strict";

import chalk from "chalk";
import { ServerlessInstance, ServerlessOptions } from "./types";
import {
  getProjectRoot,
  getGraphFromYarnProject,
  DependenciesGraph,
  IConfig,
  ConfigReader,
  Service,
  getTsConfig,
} from "@microlambda/core";
import { relative } from "path";
import { watch } from "chokidar";
import { IPluginLogger } from "./utils/logger";
import {
  stackRemove as deleteSecrets,
  stackCreate as createUpdateSecrets,
} from "./secrets";
import { IPluginConfig } from "./config";
import { validateConfig } from "./utils/validate-config";
import { inspect } from "util";
import { assign } from "./utils/assign";
import { packageService } from "./package";
import { replaceAuthorizer } from "./local-authorizer/replace-authorizer";

const stringify = (input: unknown): string => {
  if (typeof input === "object") {
    return inspect(input, { depth: 10 });
  }
  if (Array.isArray(input)) {
    return inspect(input, { depth: 10 });
  }
  return String(input);
};

class ServerlessMilaOffline {
  private static _pluginName = "Serverless Microlambda";
  public serverless: ServerlessInstance;
  public options: ServerlessOptions;
  public commands: Record<string, unknown>;
  public hooks: Record<string, unknown>;

  private _pluginConfig: IPluginConfig | undefined;
  private _graph: DependenciesGraph | undefined;
  private _config: IConfig | undefined;
  private _service: Service | undefined;
  private _outDir: string | undefined;
  private _log: IPluginLogger = {
    debug: (...args: unknown[]): void => {
      if (process.env.SLS_DEBUG) {
        this.serverless.cli.log(
          `${chalk.cyan("[debug]")}  ${args
            .map((a) => stringify(a))
            .join(" ")}`,
          ServerlessMilaOffline._pluginName
        );
      }
    },
    info: (...args: any[]): void => {
      this.serverless.cli.log(
        `${chalk.blue("[info]")}  ${args.map((a) => stringify(a)).join(" ")}`,
        ServerlessMilaOffline._pluginName
      );
    },
    warn: (...args: any[]): void => {
      this.serverless.cli.log(
        `${chalk.yellow("[warn]")}  ${args.map((a) => stringify(a)).join(" ")}`,
        ServerlessMilaOffline._pluginName
      );
    },
    error: (...args: unknown[]): void => {
      this.serverless.cli.log(
        `${chalk.red("[error]")}  ${args.map((a) => stringify(a)).join(" ")}`,
        ServerlessMilaOffline._pluginName
      );
    },
  };

  constructor(serverless: ServerlessInstance, options: ServerlessOptions) {
    this.serverless = serverless;
    this.options = options;
    this.commands = {};
    const region = this.serverless.providers.aws.getRegion();
    // Check that valid microlambda service
    // Validate configuration
    this.hooks = {
      "before:invoke:local:invoke": async (): Promise<void> => {
        this.serverless.cli.log("before:invoke:local:invoke");
      },
      "after:invoke:local:invoke": async (): Promise<void> => {
        this.serverless.cli.log("after:invoke:local:invoke");
      },
      "before:offline:start": async (): Promise<void> => {
        await this._beforeOffline();
      },
      "before:offline:start:init": async (): Promise<void> => {
        await this._beforeOffline();
      },
      "before:package:createDeploymentArtifacts": async (): Promise<void> => {
        await this._getDependenciesGraph();
        this._resolveCurrentService();
        // await packageService(this.serverless, this._service, this._log);
      },
      "after:package:createDeploymentArtifacts": async (): Promise<void> => {
        // Cleanup
        this.serverless.cli.log("after:package:createDeploymentArtifacts");
      },
      "before:deploy:function:packageFunction": async (): Promise<void> => {
        await this._getDependenciesGraph();
        this._resolveCurrentService();
        // await packageService(this.serverless, this._service, this._log);
      },
      "before:deploy:deploy": async (): Promise<void> => {
        this._loadConfig();
        replaceAuthorizer(this.serverless, this._pluginConfig, this._log);
        await createUpdateSecrets(
          region,
          this._pluginConfig?.secrets || [],
          this._log
        );
      },
      "after:deploy:deploy": async (): Promise<void> => {
        this.serverless.cli.log("after:deploy:deploy");
        // setup base path mapping

        // create latency based DNS records
      },
      "before:remove:remove": async (): Promise<void> => {
        this._loadConfig();
        await deleteSecrets(
          region,
          this._pluginConfig?.secrets || [],
          this._log
        );
      },
      "after:remove:remove": async (): Promise<void> => {
        this.serverless.cli.log("after:remove:remove");
        // remove base path mapping

        // remove latency based DNS records
      },
    };
  }

  private _loadConfig(): void {
    this._pluginConfig = validateConfig(
      this.serverless.service.custom.microlambda
    );
    this._log.debug("Configuration validated", this._pluginConfig);
  }

  private async _beforeOffline(): Promise<void> {
    await this._getDependenciesGraph();
    this._resolveCurrentService();
    this._resolveOutDir();
    await this._transpile();
    assign(
      this.serverless,
      "service.custom.serverless-offline.location",
      relative(process.cwd(), this._outDir || "lib")
    );
    this._watch();
  }

  private async _getDependenciesGraph(): Promise<void> {
    const projectRoot = getProjectRoot();
    this._log.info(`Project root resolved ${projectRoot}`);
    this._config = new ConfigReader().readConfig();
    this._graph = await getGraphFromYarnProject(projectRoot, this._config);
    this._log.info(
      `Dependencies graph resolved: ${this._graph.getNodes().length} nodes`
    );
  }

  private _resolveCurrentService(): void {
    this._log.debug(`cwd: ${process.cwd()}`);
    this._service = this._graph
      ?.getNodes()
      .find((s) => s.getLocation() === process.cwd()) as Service;
    if (!this._service) {
      this._log.error(`Error: cannot resolve microlambda service`);
      process.exit(1);
    }
    this._log.info(`Microlambda service resolved ${this._service.getName()}`);
    for (const dep of new Set(this._service.getDependencies())) {
      this._log.info(`-- Depends on ${dep.getName()}`);
    }
  }

  private _resolveOutDir(): void {
    try {
      this._outDir = getTsConfig(process.cwd()).options.outDir;
    } catch (e) {
      this._log.error(`Error: cannot resolve typescript outDir`);
      process.exit(1);
    }
    this._log.info(
      `Transpiling ${this._service?.getName()} to ${this._outDir}`
    );
  }

  private async _transpile(): Promise<void> {
    const now = Date.now();
    await this._service?.transpile().toPromise();
    const took = Date.now() - now;
    this._log.info(`${this._service?.getName()} transpiled in ${took}ms`);
  }

  private _watch(): void {
    const files: string[] = [];
    if (!this._service) {
      this._log.error(`Cannot watch: service not resolved`);
      return;
    }
    for (const dep of new Set([
      ...this._service.getDependencies(),
      this._service,
    ])) {
      const tscConfig = getTsConfig(dep.getLocation());
      files.push(...tscConfig.fileNames);
    }
    files.forEach((f) => this._log.debug(`Watching ${f}`));
    const ignoreFistAdd = new Set();
    watch(files).on("all", (event, path) => {
      if (event === "add" && !ignoreFistAdd.has(path)) {
        ignoreFistAdd.add(path);
        return;
      }
      this._log.info(`${path} changed [${event}] - Recompiling...`);
      this._transpile();
    });
  }
}

export = ServerlessMilaOffline;
