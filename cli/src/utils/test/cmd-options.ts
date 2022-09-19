import { IBuildCmd } from '../build/cmd-options';

export interface ITestCommand extends IBuildCmd {
  c?: string;
  remoteCache: boolean;
  affectedSince?: string;
}
