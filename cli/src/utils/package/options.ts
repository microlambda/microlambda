import { IBuildOptions } from '../build/options';

export interface IPackageOptions extends IBuildOptions {
  verbose: boolean;
  concurrency: number;
}
