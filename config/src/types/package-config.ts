export interface ILogsCondition {
  type: 'success' | 'failure';
  stdio: 'stdout' | 'stderr' | 'all';
  matcher: 'contains' | 'regex';
  value: string;
  timeout?: number
}

export interface ICommandConfig {
  run: string;
  env?: {[key: string]: string};
  daemon?: false | Array<ILogsCondition> | ILogsCondition;
}

export interface ITargetConfig {
  cmd: string | string[] | ICommandConfig | Array<ICommandConfig>;
  src?: {
    internals?: string[];
    deps?: string[];
    root?: string[];
  }
  artifacts?: string[];
}

export interface ITargetsConfig {
  [cmd: string]: ITargetConfig;
}

export interface IPackageConfig {
  targets?: {
    [cmd: string]: ITargetConfig;
  }
  extends?: string;
}
