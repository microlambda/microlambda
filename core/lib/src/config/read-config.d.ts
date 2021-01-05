import { IConfig } from './config';
import { Logger } from '../logger';
import { DependenciesGraph } from '../graph';
declare type Step = Map<Region, Set<Microservice>>;
declare type Region = string;
declare type Microservice = string;
export declare class ConfigReader {
    static regions: string[];
    private _services;
    private _config;
    private _schema;
    private readonly _logger;
    constructor(logger: Logger);
    get config(): IConfig;
    readConfig(): IConfig;
    validate(graph: DependenciesGraph): IConfig;
    getRegions(service: string, stage: string): string[];
    getAllRegions(stage: string): string[];
    scheduleDeployments(stage: string): Step[];
    private _buildConfigSchema;
    getCustomDomain(name: string, stage: string): string;
    getYamlTransformations(projectRoot: string): string[];
}
export {};
