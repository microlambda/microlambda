export interface IBuildCmd {
  s?: string;
  install?: boolean;
  only: boolean;
  affected?: string;
  force?: boolean;
}
