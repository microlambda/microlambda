import { IAuthorizerConfig } from "../types";

export interface ILocalAuthorizerConfig {
  replace: Partial<IAuthorizerConfig> & { remove?: boolean };
  with: IAuthorizerConfig;
}
