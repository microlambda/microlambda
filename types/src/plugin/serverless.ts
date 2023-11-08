import type { IAuthorizerConfig } from './authorizer-config';
import { LambdaRuntimes } from './packagr';

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
      deploymentBucket: { name: string } | undefined;
      deploymentPrefix: string | undefined;
      architecture: 'x86_64' | 'arm64';
      runtime: LambdaRuntimes;
      environment: { [key: string]: string };
      iam: {
        deploymentRole?: string;
        role?: {
          name: string;
          statements?: Array<{Effect: 'Allow' | 'Deny', Action: string[], Resource: string[]}>
        }
      }
    };
    custom: {
      [key: string]: unknown;
    };
    getAllFunctions: () => string[];
    functions: {
      [key: string]: {
        name: string;
        architecture: 'x86_64' | 'arm64';
        runtime: LambdaRuntimes;
        events: Array<{
          http?: { authorizer?: Partial<IAuthorizerConfig> };
          websocket?: { authorizer?: Partial<IAuthorizerConfig> };
        }>;
      };
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
