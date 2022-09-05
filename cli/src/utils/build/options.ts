import { Project } from '@microlambda/core';
import { Workspace as CentipodWorkspace } from '@microlambda/runner-core';

export interface IBuildOptions {
  project: Project;
  workspaces: CentipodWorkspace[];
  force: boolean;
  affected: { rev1: string, rev2: string } | undefined;
}
