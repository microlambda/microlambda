import Model from "dynamodels";
import { DynamoDB } from 'aws-sdk';
import { IRootConfig } from '@microlambda/config';

interface IEnvironment {
  k1: string;
  k2: 'env';
  name: string;
  regions: string[];
}

export class Environments extends Model<IEnvironment> {
  constructor(config: IRootConfig) {
    super();
    this.tableName = config.state.table;
    this.pk = 'k1';
    this.sk = 'k2';
    this.documentClient = new DynamoDB.DocumentClient({ region: config.defaultRegion });
  }

  async alreadyExists(name: string): Promise<boolean> {
    return this.exists(name, 'env');
  }

  async createNew(name: string, regions: string[]): Promise<void> {
    await this.save({
      k1: name,
      k2: 'env',
      name,
      regions,
    });
  }

  async list(): Promise<Array<IEnvironment>> {
    return this.query('GS1').keys({ k2: 'env '}).execAll();
  }
}
