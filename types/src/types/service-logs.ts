import { ServerlessAction } from './serverless-action';

export type ServiceLogs = Record<ServerlessAction, Array<string>>;
