import { IBuildCmd } from '../build/cmd-options';

export interface ITestCommand extends IBuildCmd {
  remoteCache: boolean;
  affectedSince?: string;
}
