import Model from "dynamodels";
import { DynamoDB } from 'aws-sdk';
import { IRootConfig } from '@microlambda/config';

interface IExecution {

}

interface IExecutionResult {
  took: number;
  region: string;
  bucket: string;
  key: string;
}

export class Execution extends Model<IExecution> {

  constructor(config: IRootConfig) {
    super();
    this.tableName = config.state.table;
    this.pk = 'k1';
    this.sk = 'k2';
    this.documentClient = new DynamoDB.DocumentClient({ region: config.defaultRegion });
  }

  private static _sk(env: string, workspace: string, cmd: string) {
    return `executions|${env}|${workspace}|${cmd}`;
  }

  async set(env: string, workspace: string, cmd: string, sha1: string, result: IExecutionResult): Promise<void> {

  }

  /*async fetch(env: string, workspace: string, cmd: string, sha1: string): Promise<IExecution> {

  }*/
}
