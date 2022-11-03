import { IBuildOptions } from '../build/options';

export interface ITestOptions extends IBuildOptions {
  affectedSince?: string;
  remoteCache: boolean;
}
