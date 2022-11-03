import { IAuthorizerConfig } from './authorizer-config';

export interface ILocalAuthorizerConfig {
  replace: Partial<IAuthorizerConfig> & { remove?: boolean };
  with: IAuthorizerConfig;
}
