import { Project } from "@microlambda/runner-core";
import { logger } from "../utils/logger";
import { resolveWorkspace } from "../utils/validate-workspace";
import { resolveProjectRoot } from '@microlambda/utils';

export const isAffected = async (workspaceName: string, rev1: string, rev2?: string): Promise<void> => {
  const project =  await Project.loadProject(resolveProjectRoot());
  const workspace = resolveWorkspace(project, workspaceName);
    // TODO: Better output
  logger.info(await workspace.isAffected(rev1, rev2));
};
