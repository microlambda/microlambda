import { IBuildCmd } from '../build/cmd-options';

export interface IPackageCmd extends IBuildCmd {
  e: string;
  c: string;
  level: number;
  recompile: boolean;
  forcePackage: boolean;
}
