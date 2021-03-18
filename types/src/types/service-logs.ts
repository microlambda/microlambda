import { ServerlessAction } from './serverless-action';

export type AwsRegion = string;
export type ServiceLogs = Record<ServerlessAction, Record<string, Array<string> | undefined>>;
