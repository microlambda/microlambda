import { Project } from '@microlambda/core';
import { Workspace as CentipodWorkspace } from '@microlambda/runner-core';

export interface IBuildOptions {
  verbose: boolean;
  concurrency: number;
  install: boolean;
  project: Project;
  workspaces: CentipodWorkspace[];
  force: boolean;
}
