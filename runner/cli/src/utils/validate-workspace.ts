import { Project, Workspace } from "@microlambda/runner-core";
import { logger } from "./logger";

export const resolveWorkspace = (project: Project, workspaceName: string): Workspace => {
  const workspace = project.getWorkspace(workspaceName);
  if (!workspace) {
    logger.error('No such workspace:', workspaceName);
    process.exit(1);
  }
  return workspace;
}
