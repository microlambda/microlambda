import { IPackageCmd } from '../package/cmd-options';

export interface IDeployCmd extends IPackageCmd {
  e: string;
  prompt: boolean;
  onlyPrompt: boolean;
  forceDeploy: boolean;
}
