import { IPackageCmd } from '../package/cmd-options';

export interface IDeployCmd extends IPackageCmd {
  e: string;
  prompt: boolean;
  verbose: boolean;
  onlyPrompt: boolean;
}
