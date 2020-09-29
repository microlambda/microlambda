/* eslint-disable no-console */
import { readJSONSync, existsSync } from 'fs-extra';
import { join } from 'path';
import Joi from '@hapi/joi';
import { ILernaPackage, LernaHelper } from '../../utils/lerna';

interface IRegionConfig {
  [stage: string]: string | string[];
}

type RegionConfig = string | string[] | IRegionConfig;

export interface IDeployConfig {
  defaultRegions?: RegionConfig;
  regions?: {
    [serviceName: string]: RegionConfig;
  };
  steps?: Array<string[] | '*'>;
}

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

  private _services: ILernaPackage[];
  private _config: IDeployConfig;
  private _schema: Joi.ObjectSchema;

  public async readConfig(): Promise<IDeployConfig> {
    if (!this._config) {
      await this._buildConfigSchema();
      const configPath = join(__dirname, '..', '..', '..', '.deployrc');
      if (!existsSync(configPath)) {
        this._config = {};
        return {};
      }
      const output: IDeployConfig = readJSONSync(configPath);
      const { error, value } = this._schema.validate(output);
      if (error) {
        throw error;
      }
      this._config = value;
    }
    return this._config;
  }

  public async getRegions(service: string, stage: string): Promise<string[]> {
    // console.debug('Resolving regions', { service, stage });
    const config = await this.readConfig();
    const formatRegion = (config: string | string[]): string[] => {
      if (Array.isArray(config)) {
        return config;
      }
      return [config];
    };
    const getRegion = (config: RegionConfig): string[] => {
      if (typeof config === 'string' || Array.isArray(config)) {
        return formatRegion(config);
      }
      if (config[stage]) {
        return formatRegion(config[stage]);
      }
      return null;
    };
    if (config.regions && config.regions[service]) {
      // console.debug('Regions specified at service-level', config.regions[service]);
      const regions = getRegion(config.regions[service]);
      // console.debug('Should be deployed @', regions);
      if (regions) {
        return regions;
      }
    }
    if (config.defaultRegions) {
      // console.debug('Fallback on default regions', config.defaultRegions);
      const regions = getRegion(config.defaultRegions);
      // console.debug('Should be deployed @', regions);
      if (regions) {
        return regions;
      }
    }
    // console.debug('Fallback on user preferred region', process.env.AWS_REGION);
    if (process.env.AWS_REGION) {
      return [process.env.AWS_REGION];
    }
    throw Error('Default region is not set. No fallback available');
  }

  public async getAllRegions(stage: string): Promise<string[]> {
    console.debug('Finding all region in config for stage', stage);
    const allRegions: Set<string> = new Set();
    const schedule = await this.scheduleDeployments(stage);
    for (const step of schedule) {
      for (const region of step.keys()) {
        allRegions.add(region);
      }
    }
    console.debug('All regions', [...allRegions]);
    return [...allRegions];
  }

  public async scheduleDeployments(stage: string): Promise<Step[]> {
    console.info('Scheduling deployment steps', { stage });
    const steps = (await this.readConfig()).steps;
    console.info('From config', steps);
    const schedule = async (services: string[]): Promise<Step> => {
      const step: Step = new Map();
      await Promise.all(
        services.map(async (s) => {
          const regions = await this.getRegions(s, stage);
          regions.forEach((r) => {
            if (step.has(r)) {
              step.get(r).add(s);
            } else {
              step.set(r, new Set([s]));
            }
          });
        }),
      );
      return step;
    };
    if (!steps) {
      console.debug('No specific config for steps. Using default', schedule(this._services.map((s) => s.name)));
      const step = await schedule(this._services.map((s) => s.name));
      return [step];
    }
    const builtSteps: Step[] = [];
    for (const step of steps) {
      console.debug('Scheduling', step);
      let toSchedule: string[];
      if (step === '*') {
        toSchedule = this._services
          .map((s) => s.name)
          .filter((s) => !steps.filter((step) => Array.isArray(step)).some((step) => step.includes(s)));
        console.debug('Is wildcard. Resolving all other services', toSchedule);
      } else {
        toSchedule = step;
      }
      const scheduled = await schedule(toSchedule);
      builtSteps.push(scheduled);
    }
    console.debug('Steps scheduled', builtSteps);
    return builtSteps;
  }

  private async _resolveAllServices(): Promise<void> {
    const lerna = new LernaHelper();
    this._services = await lerna.getServices();
  }

  private async _buildConfigSchema(): Promise<void> {
    await this._resolveAllServices();
    const services = Joi.string().valid(...this._services.map((s) => s.name));
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
    this._schema = Joi.object().keys({
      defaultRegions: regionSchema.optional(),
      regions: Joi.object()
        .pattern(services, regionSchema)
        .optional(),
      steps: Joi.array()
        .items(Joi.alternatives([Joi.string().valid('*'), Joi.array().items(services)]))
        .optional(),
    });
  }
}
