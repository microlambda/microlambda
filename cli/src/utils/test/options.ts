import { IBuildOptions } from '../build/options';

export interface ITestOptions extends IBuildOptions {
  concurrency: number;
  affectedSince?: string;
  remoteCache: boolean;
}
