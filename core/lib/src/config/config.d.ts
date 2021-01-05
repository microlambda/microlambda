export declare type CompilationMode = 'safe' | 'fast';
export interface IRegionConfig {
    [stage: string]: string | string[];
}
export declare type RegionConfig = string | string[] | IRegionConfig;
export declare type DomainConfig = {
    [service: string]: string;
} | {
    [service: string]: {
        [env: string]: string;
    };
};
export interface IDeployConfig {
    defaultRegions: RegionConfig;
    regions: {
        [serviceName: string]: RegionConfig;
    };
    steps: Array<string[] | '*'>;
    domains: DomainConfig;
    yamlTransforms: string[];
}
export declare type Step = Map<Region, Set<Microservice>>;
export declare type Region = string;
export declare type Microservice = string;
export interface IConfig extends IDeployConfig {
    stages: string[];
    compilationMode: CompilationMode;
    ports: {
        [key: string]: number;
    };
    noStart: string[];
    domains: {
        [service: string]: {
            [env: string]: string;
        };
    };
}
