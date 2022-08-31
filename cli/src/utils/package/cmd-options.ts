import { IBuildCmd } from '../build/cmd-options';

export interface IPackageCmd extends IBuildCmd {
  c: string;
  level: number;
  recompile: boolean;
  v: boolean;
}
