export interface ServerlessInstance {
  service: {
    service: string;
    provider: {
      stage: string;
      stackName: string;
      compiledCloudFormationTemplate: {
        Outputs: unknown;
      };
      apiGateway: {
        restApiId: string;
      };
    };
    custom: {
      [key: string]: unknown;
    };
  };
  providers: {
    aws: {
      sdk: {
        APIGateway: unknown;
        Route53: unknown;
        CloudFormation: unknown;
        ACM: unknown;
        config: {
          update(toUpdate: Record<string, unknown>): void;
        };
      };
      getCredentials(): unknown;
      getRegion(): string;
    };
  };
  pluginManager: {
    spawn: (plugin: string) => Promise<void>;
  };
  cli: {
    log(...args: unknown[]): unknown;
    consoleLog(...args: unknown[]): unknown;
  };
  [key: string]: unknown;
}

export interface ServerlessOptions {
  stage: string;
}
