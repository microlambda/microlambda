import { IServicePortsConfig } from '../resolve-ports';

export type CompilationMode = 'safe' | 'fast';

export interface IRegionConfig {
  [stage: string]: string | string[];
}

export type RegionConfig = string | string[] | IRegionConfig;

export type DomainConfig = { [service: string]: string } | { [service: string]: { [env: string]: string } };

export interface IDeployConfig {
  defaultRegions: RegionConfig;
  regions: {
    [serviceName: string]: RegionConfig;
  };
  steps: Array<string[] | '*'>;
  domains: DomainConfig;
  yamlTransforms: string[];
}

export type Step = Map<Region, Set<Microservice>>;
export type Region = string;
export type Microservice = string;

export interface IConfig extends IDeployConfig {
  stages: string[];
  compilationMode: CompilationMode;
  ports: { [key: string]: number | Partial<IServicePortsConfig> };
  noStart: string[];
  domains: {
    [service: string]: {
      [env: string]: string;
    };
  };
}
