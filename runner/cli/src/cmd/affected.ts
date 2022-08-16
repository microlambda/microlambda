import { Project, resolveProjectRoot, Workspace } from "@microlambda/runner-core";
import { logger } from "../utils/logger";

export const affected = async (rev1: string, rev2?: string): Promise<void> => {
  const project =  await Project.loadProject(resolveProjectRoot());
  const affected = new Set<Workspace>();
  for (const workspace of project.workspaces.values()) {
    if (await workspace.isAffected(rev1, rev2)) {
      affected.add(workspace);
    }
  }
  // TODO: Better output
  logger.info('Workspaces affected', rev2 ? rev1 : 'HEAD', '->', rev2 || rev1, '\n');
  logger.info(Array.from(affected).map(a => a.name).join('\n'));
};
