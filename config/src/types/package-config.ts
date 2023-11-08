export interface ILogsCondition {
  type: 'success' | 'failure';
  stdio: 'stdout' | 'stderr' | 'all';
  matcher: 'contains' | 'regex';
  value: string;
  timeout?: number;
}

export interface ICommandConfig {
  run: string;
  env?: Record<string, string>;
  daemon?: false | Array<ILogsCondition> | ILogsCondition;
}

export interface ITargetCacheConfig {
  src?: {
    internals?: string[];
    deps?: string[];
    root?: string[];
  };
  artifacts?: string[];
}

export interface ITargetConfigScript extends ITargetCacheConfig {
  script: string;
  env?: Record<string, string>;
  daemon?: false | Array<ILogsCondition> | ILogsCondition;
}

export interface ITargetConfigCmd extends ITargetCacheConfig {
  cmd: string | string[] | ICommandConfig | Array<ICommandConfig>;
}

export type ITargetConfig = ITargetConfigScript | ITargetConfigCmd;

export const isScriptTarget = (target: ITargetConfig): target is ITargetConfigScript =>
  !!(target as ITargetConfigScript)?.script;

export interface ITargetsConfig {
  [cmd: string]: ITargetConfig;
}

interface IPortsConfig {
  http?: number;
  lambda?: number;
  websocket?: number;
}

export interface IPackageConfig {
  regions?: string[];
  targets?: {
    [cmd: string]: ITargetConfig;
  };
  ports?: IPortsConfig | number;
  extends?: string;
}

export interface IResolvedPackageConfig {
  regions?: string[];

  sharedInfra?: { envSpecific?: boolean };
  targets: {
    [cmd: string]: ITargetConfig;
  };
  ports?: IPortsConfig | number;
}
