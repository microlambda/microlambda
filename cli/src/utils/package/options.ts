import { IBuildOptions } from '../build/options';

export interface IPackageOptions extends IBuildOptions {
  concurrency: number;
  recompile: boolean;
  forcePackage: boolean;
}
