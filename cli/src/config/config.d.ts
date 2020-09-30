export type CompilationMode = 'safe' | 'fast';

interface IRegionConfig {
  [stage: string]: string | string[];
}

type RegionConfig = string | string[] | IRegionConfig;

type DomainConfig = {[service: string]: string} | {[service: string]: {[env: string]: string}};

export interface IDeployConfig {
  defaultRegions: RegionConfig;
  regions: {
    [serviceName: string]: RegionConfig;
  };
  steps: Array<string[] | '*'>;
  domains: DomainConfig;
}

type Step = Map<Region, Set<Microservice>>;
type Region = string;
type Microservice = string;

export interface IConfig extends IDeployConfig {
  stages: string[];
  compilationMode: CompilationMode;
  ports: { [key: string]: number };
  noStart: string[];
}
