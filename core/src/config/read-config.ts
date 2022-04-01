import Joi, { ObjectSchema } from '@hapi/joi';
import { IConfig, RegionConfig } from './config';
import rc from 'rc';
import fallback from './default.json';
import { Logger, Loggers } from '@microlambda/logger';
import { sync } from 'glob';
import { join } from 'path';
import {Project} from "../graph/project";

type Step = Map<Region, Set<Microservice>>;
type Region = string;
type Microservice = string;

export class ConfigReader {
  public static regions = [
    'us-east-1',
    'us-east-2',
    'us-west-1',
    'us-west-2',
    'ca-central-1',
    'eu-west-1',
    'eu-west-2',
    'eu-west-3',
    'eu-central-1',
    'ap-southeast-1',
    'ap-southeast-2',
    'ap-northeast-1',
    'ap-northeast-2',
    'ap-northeast-3',
    'eu-north-1',
    'sa-east-1',
    'cn-north-1',
    'cn-northwest-1',
    'ap-east-1',
    'me-south-1',
    'ap-south-1',
  ];
  private _services: string[] = [];
  private _config: IConfig | undefined;
  private _schema: Joi.ObjectSchema | undefined;
  private readonly _logger: Loggers | undefined;

  constructor(logger?: Logger) {
    this._logger = logger?.log('@microlambda/core/config');
  }

  get config(): IConfig | undefined {
    return this._config;
  }

  public readConfig(): IConfig {
    this._config = rc<IConfig>('microlambda', fallback as IConfig);
    return this._config;
  }

  public validate(graph: Project): IConfig {
    this._services = Array.from(graph.services.keys());
    this._schema = this._buildConfigSchema();
    if (!this._config) {
      this._config = this.readConfig();
    }
    this._logger?.debug('raw config', this._config);
    const { error, value } = this._schema.validate(this._config);
    if (error) {
      this._logger?.error('validation errors', error);
      throw error;
    }
    this._logger?.info('config valid');
    this._config = value as IConfig;
    return this._config;
  }

  public getRegions(service: string, stage: string): string[] {
    this._logger?.debug('Resolving regions', { service, stage });
    const config = this.readConfig();
    const formatRegion = (config: string | string[]): string[] => {
      if (Array.isArray(config)) {
        return config;
      }
      return [config];
    };
    const getRegion = (config: RegionConfig): string[] | null => {
      if (typeof config === 'string' || Array.isArray(config)) {
        return formatRegion(config);
      }
      if (config[stage]) {
        return formatRegion(config[stage]);
      }
      return null;
    };
    if (config.regions && config.regions[service]) {
      this._logger?.debug('Regions specified at service-level', config.regions[service]);
      const regions = getRegion(config.regions[service]);
      this._logger?.debug('Should be deployed @', regions);
      if (regions) {
        return regions;
      }
    }
    if (config.defaultRegions) {
      this._logger?.debug('Fallback on default regions', config.defaultRegions);
      const regions = getRegion(config.defaultRegions);
      this._logger?.debug('Should be deployed @', regions);
      if (regions) {
        return regions;
      }
    }
    this._logger?.debug('Fallback on user preferred region', process.env.AWS_REGION);
    if (process.env.AWS_REGION) {
      return [process.env.AWS_REGION];
    }
    throw Error('Default region is not set. No fallback available');
  }

  public getAllRegions(stage: string): string[] {
    this._logger?.debug('Finding all region in config for stage', stage);
    const allRegions: Set<string> = new Set();
    const schedule = this.scheduleDeployments(stage);
    for (const step of schedule) {
      for (const region of step.keys()) {
        allRegions.add(region);
      }
    }
    this._logger?.debug('All regions', [...allRegions]);
    return [...allRegions];
  }

  public scheduleDeployments(stage: string): Step[] {
    this._logger?.info('Scheduling deployment steps', { stage });
    const steps = this.readConfig().steps;
    this._logger?.info('From config', steps);
    const schedule = (services: string[]): Step => {
      const step: Step = new Map();
      services.forEach((s) => {
        const regions = this.getRegions(s, stage);
        regions.forEach((r) => {
          const regionServices = step.get(r);
          if (regionServices) {
            regionServices.add(s);
          } else {
            step.set(r, new Set([s]));
          }
        });
      });
      return step;
    };
    if (!steps) {
      this._logger?.debug(
        'No specific config for steps. Using default',
        schedule(this._services),
      );
      const step = schedule(this._services);
      return [step];
    }
    const builtSteps: Step[] = [];
    for (const step of steps) {
      this._logger?.debug('Scheduling', step);
      let toSchedule: string[];
      if (step === '*') {
        toSchedule = this._services
          .filter((s) => !steps.filter((step) => Array.isArray(step)).some((step) => step.includes(s)));
        this._logger?.debug('Is wildcard. Resolving all other services', toSchedule);
      } else {
        toSchedule = step;
      }
      const scheduled = schedule(toSchedule);
      builtSteps.push(scheduled);
    }
    this._logger?.debug('Steps scheduled', builtSteps);
    return builtSteps;
  }

  private _buildConfigSchema(): ObjectSchema {
    const services = Joi.string().valid(...this._services);
    const regionSchema = Joi.alternatives([
      Joi.string().valid(...ConfigReader.regions),
      Joi.array().items(Joi.string().valid(...ConfigReader.regions)),
      Joi.object().pattern(
        Joi.string().alphanum(),
        Joi.alternatives([
          Joi.string().valid(...ConfigReader.regions),
          Joi.array().items(Joi.string().valid(...ConfigReader.regions)),
        ]),
      ),
    ]);
    const schema = Joi.object()
      .keys({
        stages: Joi.array().items(Joi.string()).optional().allow(null),
        compilationMode: Joi.string().valid('safe', 'fast'),
        ports: Joi.object().pattern(
          services,
          Joi.alternatives(
            Joi.number().integer().greater(0).less(64738),
            Joi.object().keys({
              http: Joi.number().integer().greater(0).less(64738).optional(),
              lambda: Joi.number().integer().greater(0).less(64738).optional(),
              websocket: Joi.number().integer().greater(0).less(64738).optional(),
            }),
          ),
        ),
        noStart: Joi.array().items(services).optional(),
        defaultRegions: regionSchema.optional().allow(null),
        regions: Joi.object().pattern(services, regionSchema).optional(),
        steps: Joi.array()
          .items(Joi.alternatives([Joi.string().valid('*'), Joi.array().items(services)]))
          .optional(),
        domains: Joi.object().pattern(services, Joi.object().pattern(Joi.string(), Joi.string()).optional()).optional(),
        yamlTransforms: Joi.array().items(Joi.string()).optional(),
      })
      .unknown(true);
    this._schema = schema;
    return schema;
  }

  getCustomDomain(name: string, stage: string): string | null {
    if (!this._config) {
      throw new Error('Config has not been read');
    }
    return this._config.domains[name] ? this._config.domains[name][stage] : null;
  }

  getYamlTransformations(projectRoot: string): string[] {
    if (!this._config) {
      throw new Error('Config has not been read');
    }
    const matches: Set<string> = new Set();
    this._config.yamlTransforms
      .map((glob) => join(projectRoot, glob))
      .forEach((glob) => {
        sync(glob).forEach((path) => matches.add(path));
      });
    return Array.from(matches);
  }
}
