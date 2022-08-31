import Model, { beginsWith } from 'dynamodels';
import { DynamoDB } from 'aws-sdk';
import { IRootConfig } from '@microlambda/config';

export interface IEnvironment {
  k1: string; // $name
  k2: string; // 'env'
  name: string;
  regions: string[];
}

export interface IServiceInstance {
  k1: string; // $name
  k2: string; // service|$env|$region
  k3: string; // service|$env
  name: string;
  region: string;
  sha1: string;
  checksums_buckets: string;
  checksums_key: string;
}

export class State extends Model<unknown> {
  constructor(config: IRootConfig) {
    super();
    this.tableName = config.state.table;
    this.pk = 'k1';
    this.sk = 'k2';
    this.documentClient = new DynamoDB.DocumentClient({ region: config.defaultRegion });
  }

  async environmentExists(name: string): Promise<boolean> {
    return this.exists(name, 'env');
  }

  async findEnv(name: string): Promise<IEnvironment> {
    const env = await this.get(name, 'env');
    return env as IEnvironment;
  }

  async removeEnv(name: string): Promise<void> {
    await this.delete(name, 'env');
  }

  async createEnvironment(name: string, regions: string[]): Promise<void> {
    await this.save({
      k1: name,
      k2: 'env',
      name,
      regions,
    });
  }

  async listEnvironments(): Promise<Array<IEnvironment>> {
    const envs = await this.query('GS1').keys({ k2: 'env' }).execAll();
    return envs as IEnvironment[];
  }

  async listServices(env: string): Promise<Array<IServiceInstance>> {
    const services = await this.query('GS2').keys({ k3: `service|${env}` }).execAll();
    return services as IServiceInstance[];
  }

  async createReplicate(env: string, region: string): Promise<void> {
    const toUpdate = await this.findEnv(env);
    toUpdate.regions.push(region);
    await this.save(toUpdate);
  }

  async removeReplicate(env: string, region: string): Promise<void> {
    const toUpdate = await this.findEnv(env);
    toUpdate.regions = toUpdate.regions.filter((r) => r !== region);
    await this.save(toUpdate);
  }

  async listServiceInstances(env: string, serviceName: string): Promise<Array<IServiceInstance>> {
    const services = await this.query().keys({
      k1: serviceName,
      k2: beginsWith( `service|${env}`),
    }).execAll();
    return services as IServiceInstance[];
  }
}
