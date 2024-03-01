import { resolveProjectRoot } from '@microlambda/utils';
import { Project, Workspace } from '@microlambda/runner-core';
import { State } from '@microlambda/remote-state';
import { IRootConfig } from '@microlambda/config';
import { readConfig } from './read-config';
import { verifyState } from './verify-state';

export const resolveDeltas = async (options: {
  cmd: string;
  branch: string;
  project?: Project;
  config?: IRootConfig;
  state?: State;
}): Promise<Array<Workspace & { shouldRun: boolean }>> => {
  const projectRoot = options.project?.root ?? resolveProjectRoot();
  const project = options.project ?? (await Project.loadProject(projectRoot));
  const config = options.config ?? readConfig(projectRoot);
  const state = options.state ?? new State(config.state.table, config.defaultRegion);
  await verifyState(config);
  for (const workspace of project.workspaces.values()) {
    if (workspace.hasCommand(options.cmd)) {
      //const deployedServices = await state.getExecution()
    }
  }
  return [];
};
