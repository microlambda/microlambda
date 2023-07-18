import { ApiType } from './api-type';

export interface IDomainConfig {
  domainName: string;
  basePath?: string;
  type?: ApiType; // default rest
}
