import { IBuildOptions } from '../build/options';

export interface IPackageOptions extends IBuildOptions {
  recompile: boolean;
  forcePackage: boolean;
}
