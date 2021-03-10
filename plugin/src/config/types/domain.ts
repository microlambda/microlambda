import { ApiType } from "../../types";

export interface IDomainConfig {
  domainName: string;
  basePath?: string;
  type?: ApiType; // default rest
}
