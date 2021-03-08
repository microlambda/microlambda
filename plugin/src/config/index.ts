import { ISecretConfig } from "./secrets";
import { IDomainConfig } from "./domain";

export { IDomainConfig, ISecretConfig };

export interface IPluginConfig {
  secrets: ISecretConfig[];
  domain: IDomainConfig;
}
