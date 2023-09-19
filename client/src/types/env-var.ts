export interface IAwsAccount {
  connected: boolean;
  account?: { username: string; arn: string };
}

export interface ILoadedEnvironmentVariable {
  key: string;
  value?: string;
  from: string;
  raw?: string;
  overwritten?: boolean;
}

export interface IEnvironment {
  name: string;
  regions: string[];
}

export interface IServiceInstance {
  name: string;
  region: string;
  env: string;
  sha1: string;
  checksums_buckets: string;
  checksums_key: string;
}
