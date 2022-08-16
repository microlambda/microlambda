export interface Package {
  name: string;
  version?: string;
  private?: boolean;
  workspaces?: string[];
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export interface INpmInfos {
  name: string;
  versions: string[];
}
