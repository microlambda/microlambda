import Model, {beginsWith, IUpdateActions} from 'dynamodels';
import { DynamoDB } from 'aws-sdk';
import { IRootConfig } from '@microlambda/config';
import {currentSha1} from "@microlambda/runner-core";

export interface IEnvironment {
  k1: string; // $name
  k2: string; // 'env'
  name: string;
  regions: string[];
  useCanary?: boolean;
  currentVersion?: number;
}

export interface ICanaryVersion {
  k1: string; // $n
  k2: string; // versions|$env
  version: number; // $n
  active: boolean;
  createdAt: string;
  lastDeploymentSha1: string;
}

export interface IServiceInstanceRequest {
  name: string;
  region: string;
  env: string;
  sha1: string;
  checksums_buckets: string;
  checksums_key: string;
}

export interface ILayerChecksumsRequest {
  service: string;
  env: string;
  checksums_buckets: string;
  checksums_key: string;
  region: string;
}

export interface ICmdExecutionRequest {
  service: string;
  branch: string;
  cmd: string;
  current_sha1: string;
  region: string;
}

export interface ICmdExecution extends ICmdExecutionRequest {
  k1: string; // $branch
  k2: string; // executions|$service|$cmd
}

export interface ILayerChecksums extends ILayerChecksumsRequest {
  k1: string; // $serviceName
  k2: string; // layer|$env
}

export interface IServiceInstance extends IServiceInstanceRequest {
  k1: string; // $name
  k2: string; // service|$env|$region
  k3: string; // service|$env
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

  async createServiceInstance(req: IServiceInstanceRequest): Promise<void> {
    await this.save({
      k1: req.name,
      k2: `service|${req.env}|${req.region}`,
      k3: `service|${req.env}`,
      ...req,
    })
  }

  async getLastLayerChecksums(service: string, env: string): Promise<ILayerChecksums> {
    const layer = await this.get(service, `layer|${env}`);
    return layer as ILayerChecksums;
  }

  async setLayerChecksums(req: ILayerChecksumsRequest): Promise<void> {
    await this.save({
      k1: req.service,
      k2: `layer|${req.env}`,
      ...req,
    })
  }

  async getExecution(branch: string, command: string, service: string): Promise<ICmdExecution> {
    const exec = await this.get(branch, `executions|${service}|${command}`);
    return exec as ICmdExecution;
  }

  async saveExecution(request: ICmdExecutionRequest): Promise<void> {
    await this.save({
      k1: request.branch,
      k2: `executions|${request.service}|${request.cmd}`,
      ...request,
    });
  }

  async listVersions(env: string): Promise<Array<ICanaryVersion>> {
    const versions = await this.query('GS1').keys({ k2: `versions|${env}` }).execAll();
    return versions as ICanaryVersion[];
  }

  async incrementVersion(env: IEnvironment): Promise<void> {
    const incrementedVersion = env.useCanary && env.currentVersion ? env.currentVersion + 1 : 2;
    const actions: IUpdateActions = {
      currentVersion: {
        action: 'PUT',
        value: incrementedVersion,
      }
    };
    if (!env.useCanary) {
      actions.useCanary = {
        action: 'PUT',
        value: true,
      }
    }
    const updateEnv$ = this.update(env.k1, env.k2, actions);
    const createVersion$ = this.save({
      k1: incrementedVersion,
      k2: `versions|${env.name}`,
      version: incrementedVersion,
      active: true,
      createdAt: new Date().toISOString(),
    });
    await Promise.all([updateEnv$, createVersion$])
  }

  async updateLastDeploymentSha1(env: IEnvironment): Promise<void> {
    if (env.currentVersion) {
      await this.update(env.currentVersion, `versions|${env.name}`, {
        lastDeploymentSha1: {
          action: 'PUT',
          value: currentSha1(),
        }
      });
    }
  }
}
