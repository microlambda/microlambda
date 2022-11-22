"use strict";

import { IBaseLogger, ServerlessInstance, IPluginConfig } from "@microlambda/types";
import { validateConfig } from "./config";
import {
  ConfigReader,
  IConfig,
  Project,
  Workspace,
} from "@microlambda/core";
import { PluginLogger } from "@microlambda/logger";
import {
  afterDeploy,
  afterRemove,
  beforeDeploy,
  beforeOffline,
  beforeRemove,
  createUpdateSecrets,
  deleteSecrets,
  packageService,
  replaceAuthorizer,
} from "./features";
import { applyConditions } from "./features/conditions/apply-conditions";
import { resolveProjectRoot } from '@microlambda/utils';
import { removeDotServerless } from './features/package/remove-dot-serverless';

class ServerlessMicrolambdaPlugin {
  private static _pluginName = "Serverless Microlambda";
  public serverless: ServerlessInstance;
  public commands: Record<string, unknown>;
  public hooks: Record<string, unknown>;

  private _pluginConfig: IPluginConfig | undefined;
  private _graph: Project | undefined;
  private _config: IConfig | undefined;
  private _service: Workspace | undefined;
  private readonly _log: IBaseLogger;

  constructor(serverless: ServerlessInstance) {
    this.serverless = serverless;
    this._log = new PluginLogger(
      this.serverless,
      ServerlessMicrolambdaPlugin._pluginName
    );
    this.commands = {};
    // Check that valid microlambda service
    // Validate configuration
    this.hooks = {
      "before:invoke:local:invoke": async (): Promise<void> => {
        this._log.debug("Hook triggered", "before:invoke:local:invoke");
      },
      "after:invoke:local:invoke": async (): Promise<void> => {
        this._log.debug("Hook triggered", "after:invoke:local:invoke");
      },
      "before:offline:start": this._plugHook(async () => {
        this._log.debug("Hook triggered", "before:offline:start");
        await beforeOffline(this.serverless, this._service, this._log);
      }),
      "before:offline:start:init": this._plugHook(async () => {
        this._log.debug("Hook triggered", "before:offline:start:init");
        await beforeOffline(this.serverless, this._service, this._log);
      }),
      "before:package:createDeploymentArtifacts": this._plugHook(async () => {
        this._log.debug(
          "Hook triggered",
          "before:package:createDeploymentArtifacts"
        );
        replaceAuthorizer(this.serverless, this._pluginConfig, this._log);
        applyConditions(
          this.serverless,
          this._pluginConfig?.conditions || [],
          this._log
        );
        const { stackName } = this._resolveBasicInformation();
        if (this._pluginConfig?.packagr?.useLayer) {
          this.serverless.service.provider.environment.NODE_PATH = './:/opt/node_modules';
        }
        await removeDotServerless(this._service);
        await packageService(this.serverless, stackName, this._pluginConfig, this._service, this._log);
      }),
      "after:package:createDeploymentArtifacts": async (): Promise<void> => {
        // Cleanup
        this._log.debug(
          "Hook triggered",
          "after:package:createDeploymentArtifacts"
        );
      },
      "before:deploy:function:packageFunction": this._plugHook(async () => {
        this._log.debug(
          "Hook triggered",
          "before:deploy:function:packageFunction"
        );
        replaceAuthorizer(this.serverless, this._pluginConfig, this._log);
        applyConditions(
          this.serverless,
          this._pluginConfig?.conditions || [],
          this._log
        );
        const { stackName } = this._resolveBasicInformation();
        await removeDotServerless(this._service);
        await packageService(this.serverless, stackName, this._pluginConfig, this._service, this._log);
      }),
      "before:deploy:deploy": this._plugHook(
        async (): Promise<void> => {
          const { region } = this._resolveBasicInformation();
          this._log.debug("Hook triggered", "before:deploy:deploy");
          await createUpdateSecrets(
            region,
            this._pluginConfig?.secrets || [],
            this._log
          );
          await beforeDeploy(
            region,
            this._pluginConfig?.domain?.domainName,
            this.serverless.service.service,
            this._log
          );
          const customBucket = this.serverless.service.provider
            .deploymentBucket;
          if (customBucket) {
            this._log.debug(
              "Uploading code in bucket",
              customBucket,
              "at",
              this.serverless.service.provider.deploymentPrefix || "/"
            );
          }
        }
      ),
      "after:deploy:deploy": this._plugHook(async () => {
        this._log.debug("Hook triggered", "after:deploy:deploy");
        const { region, stage, stackName } = this._resolveBasicInformation();
        await afterDeploy(
          region,
          stackName,
          stage,
          this._pluginConfig?.domain,
          this._log
        );
      }),
      "before:remove:remove": this._plugHook(async () => {
        this._log.debug("Hook triggered", "before:remove:remove");
        const { region } = this._resolveBasicInformation();
        this._loadConfig();
        await deleteSecrets(
          region,
          this._pluginConfig?.secrets || [],
          this._log
        );
        await beforeRemove(region, this._pluginConfig?.domain, this._log);
      }),
      "after:remove:remove": this._plugHook(async () => {
        this._log.debug("Hook triggered", "after:remove:remove");
        const { region } = this._resolveBasicInformation();
        await afterRemove(
          region,
          this._pluginConfig?.domain?.domainName,
          this._log
        );
      }),
    };
  }

  private _resolveBasicInformation(): { region: string, stage: string, stackName: string } {
    const region = this.serverless.providers.aws.getRegion();
    this._log.info("Region resolved", region);
    const stage = this.serverless.service.provider.stage;
    this._log.info("Stage resolved", stage);
    const stackName =
        this.serverless.service.provider.stackName ||
        `${this.serverless.service.service}-${stage}`;
    this._log.info("Stack name resolved", stackName);
    return { region, stage, stackName };
  }

  private _plugHook(
    func: () => Promise<unknown> | unknown
  ): () => Promise<void> {
    return async (): Promise<void> => {
      this._loadConfig();
      await this._resolveCurrentService();
      if (typeof func === "function") {
        await func();
      } else {
        await func;
      }
    };
  }

  private _loadConfig(): void {
    if (!this._pluginConfig) {
      if (!this.serverless.service.custom?.microlambda) {
        this._pluginConfig = {};
        return;
      }
      this._pluginConfig = validateConfig(
        this.serverless.service.custom.microlambda
      );
      this._log.debug("Configuration validated", this._pluginConfig);
    }
  }

  private async _getDependenciesGraph(): Promise<void> {
    if (!this._graph) {
      const projectRoot = resolveProjectRoot();
      this._log.info(`Project root resolved ${projectRoot}`);
      this._config = new ConfigReader().readConfig();
      this._graph = await Project.loadProject(projectRoot);
      this._log.info(
        `Dependencies graph resolved: ${this._graph.workspaces.size} nodes`
      );
      process.env.MILA_SERVICES_LENGTH = this._graph
        .services
        .size.toString();
    }
  }

  private async _resolveCurrentService(): Promise<void> {
    if (!this._graph) {
      await this._getDependenciesGraph();
    }
    if (!this._graph) {
      this._log.error('Assertion failed: dependencies graph is not resolved');
      process.exit(1);
    }
    if (!this._service) {
      const normalizedCwd = process.cwd().replaceAll('\\', '/');
      this._log.debug(`cwd: ${normalizedCwd}`);
      this._service = Array.from(this._graph.services.values()).find((s) => s.root === normalizedCwd);
      if (!this._service) {
        this._log.error(`Error: cannot resolve microlambda service`);
        process.exit(1);
      }
      this._log.info(`Microlambda service resolved ${this._service.name}`);
      for (const dep of new Set(this._service.dependencies())) {
        this._log.info(`-- Depends on ${dep.name}`);
      }
    }
  }
}

export = ServerlessMicrolambdaPlugin;
