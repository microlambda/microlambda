export interface IReplicateCmd {
  force: boolean;
  forceDeploy: boolean;
  forcePackage: boolean;
  prompt: boolean;
  onlyPrompt: boolean;
  skipLock: boolean;
  c: string;
  level: number;
  recompile: boolean;
  install: boolean;
  verbose: boolean;
  deploy: boolean;
}
