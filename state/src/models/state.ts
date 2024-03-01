import Model, { beginsWith, eq } from 'dynamodels';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { IRootConfig } from '@microlambda/config';
import hasha from 'hasha';

export interface IEnvironment {
  k1: string; // $name
  k2: string; // 'env'
  name: string;
  regions: string[];
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

export interface IExecutionHash {
  args: string[] | string;
  cmd: string;
  env: { [p: string]: string };
  workspace: string;
}

export interface IBranchExecutionHash extends IExecutionHash {
  branch: string;
}

export interface ICmdExecutionRequest extends IExecutionHash {
  sha1: string;
  bucket: string;
  checksums: string;
  outputs: string;
  region: string;
}

export interface ICmdExecution {
  k1: string;
  k2: string;
  k3: string;
  k4: string;
  env: string;
  sha1: string;
  bucket: string;
  checksums: string;
  outputs: string;
  region: string;
  cmd: string;
  args: string;
  workspace: string;
}

export interface ILayerChecksums extends ILayerChecksumsRequest {
  /**
   * $serviceName
   */
  k1: string;
  /**
   * layer|$env
   */
  k2: string;
}

export interface IServiceInstance extends IServiceInstanceRequest {
  /**
   * $name
   */
  k1: string; // $name
  /**
   * service|$env|$region
   */
  k2: string;
  /**
   * service|$env
   */
  k3: string;
}

export interface ISharedInfraStateRequest {
  name: string;
  region: string;
  env?: string;
  sha1: string;
  checksums_buckets: string;
  checksums_key: string;
}

export interface ISharedInfraState extends ISharedInfraStateRequest {
  k1: string; // $yml
  k2: string; // Shared-infra|$region
}

export class State extends Model<unknown> {
  constructor(readonly tableName: string, awsRegion: string) {
    super();
    this.pk = 'k1';
    this.sk = 'k2';
    this.documentClient = DynamoDBDocument.from(new DynamoDB({ region: awsRegion }));
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
    const services = await this.query('GS2')
      .keys({ k3: `service|${env}` })
      .execAll();
    return services as IServiceInstance[];
  }

  async createReplicate(env: string, region: string): Promise<IEnvironment> {
    const toUpdate = await this.findEnv(env);
    toUpdate.regions.push(region);
    await this.save(toUpdate);
    return toUpdate;
  }

  async removeReplicate(env: string, region: string): Promise<IEnvironment> {
    const toUpdate = await this.findEnv(env);
    toUpdate.regions = toUpdate.regions.filter((r) => r !== region);
    await this.save(toUpdate);
    return toUpdate;
  }

  async listServiceInstances(env: string, serviceName: string): Promise<Array<IServiceInstance>> {
    const services = await this.query()
      .keys({
        k1: serviceName,
        k2: beginsWith(`service|${env}`),
      })
      .execAll();
    return services as IServiceInstance[];
  }

  async createServiceInstance(req: IServiceInstanceRequest): Promise<void> {
    await this.save({
      k1: req.name,
      k2: `service|${req.env}|${req.region}`,
      k3: `service|${req.env}`,
      ...req,
    });
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
    });
  }

  async removeServiceInstances(options: { service: string; env: string; region: string }): Promise<void> {
    await this.delete(options.service, `service|${options.env}|${options.region}`);
  }

  async getSharedInfrastructureState(yml: string, env?: string): Promise<Array<ISharedInfraState>> {
    const currentState = (await this.query()
      .keys({
        k1: eq(yml),
        k2: beginsWith('shared-infra|'),
      })
      .execAll()) as ISharedInfraState[];
    return currentState.filter((s) => !env || !s.env || s.env === env);
  }

  async setSharedInfrastructureState(request: ISharedInfraStateRequest): Promise<void> {
    await this.save({
      k1: request.name,
      k2: request.env ? `shared-infra|${request.env}|${request.region}` : `shared-infra|${request.region}`,
      ...request,
    });
  }

  async deleteSharedInfrastructureState(name: string, region: string, env?: string): Promise<void> {
    await this.delete(name, env ? `shared-infra|${env}|${region}` : `shared-infra|${region}`);
  }

  private _getBranchExecutionHash(params: IBranchExecutionHash): string {
    return hasha(JSON.stringify(params));
  }

  private _getExecutionHash(params: IExecutionHash): string {
    return hasha(JSON.stringify(params));
  }

  async setExecution(params: ICmdExecutionRequest): Promise<void> {
    const exec: ICmdExecution = {
      k1: params.sha1,
      k2: `exec|${this._getExecutionHash({
        cmd: params.cmd,
        args: params.args,
        env: params.env,
        workspace: params.workspace,
      })}`,
      k3: 'executions',
      k4: params.workspace,
      cmd: params.cmd,
      args: JSON.stringify(params.args),
      env: JSON.stringify(params.env),
      bucket: params.bucket,
      checksums: params.checksums,
      sha1: params.sha1,
      workspace: params.workspace,
      outputs: params.outputs,
      region: params.region,
    };
    await this.save(exec);
  }

  async getExecution(params: IExecutionHash & { sha1: string }): Promise<ICmdExecution> {
    const exec = await this.get(
      params.sha1,
      this._getExecutionHash({
        cmd: params.cmd,
        args: params.args,
        env: params.env,
        workspace: params.workspace,
      }),
    );
    return exec as ICmdExecution;
  }

  async setBranchExecution(params: IBranchExecutionHash & { sha1: string }): Promise<void> {
    await this.save({
      k1: params.sha1,
      k2: this._getBranchExecutionHash({
        branch: params.branch,
        cmd: params.cmd,
        args: params.args,
        env: params.env,
        workspace: params.workspace,
      }),
      k3: params.branch,
      k4: params.workspace,
      cmd: params.cmd,
      args: JSON.stringify(params.args),
      env: JSON.stringify(params.env),
      branch: params.branch,
    });
  }

  async getBranchExecutions(params: IBranchExecutionHash): Promise<string[]> {
    const items = await this.query('GS1')
      .keys({
        k2: this._getBranchExecutionHash({
          branch: params.branch,
          cmd: params.cmd,
          args: params.args,
          env: params.env,
          workspace: params.workspace,
        }),
      })
      .projection(['k1'])
      .execAll();
    return items.map((i) => (i as { k1: string }).k1);
  }

  async removeBranchExecution(params: IBranchExecutionHash & { sha1: string }): Promise<void> {
    await this.delete(
      params.sha1,
      this._getBranchExecutionHash({
        branch: params.branch,
        cmd: params.cmd,
        args: params.args,
        env: params.env,
        workspace: params.workspace,
      }),
    );
  }

  async removeExecution(params: IExecutionHash & { sha1: string }): Promise<void> {
    await this.get(
      params.sha1,
      this._getExecutionHash({
        cmd: params.cmd,
        args: params.args,
        env: params.env,
        workspace: params.workspace,
      }),
    );
  }
}
