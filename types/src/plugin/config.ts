import { ISecretConfig } from './secrets';
import { IDomainConfig } from './domain';
import { ILocalAuthorizerConfig } from './local-authorizer';
import { Condition } from './conditions';
import { IPackagrConfig } from './packagr';

export interface IPluginConfig {
  secrets?: ISecretConfig[];
  domain?: IDomainConfig;
  localAuthorizer?: ILocalAuthorizerConfig[] | ILocalAuthorizerConfig;
  conditions?: Condition[];
  transforms?: string;
  packagr?: IPackagrConfig;
}
