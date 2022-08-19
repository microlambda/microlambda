import { ITargetsConfig } from './package-config';

export interface IRootConfig {
  "defaultRegion": string;
  "defaultRuntime": string;
  "state": {
    "checksums": string;
    "table": string;
  },
  "sharedResources"?: {
    "shared"?: string;
    "env"?: string;
  },
  "targets"?: ITargetsConfig;
}
