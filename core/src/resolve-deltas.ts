import { resolveProjectRoot } from '@microlambda/utils';
import { Checksums, ISourcesChecksums, Project, Workspace } from '@microlambda/runner-core';
import { ICmdExecution, State } from '@microlambda/remote-state';
import { IRootConfig } from '@microlambda/config';
import { readConfig } from './read-config';
import { verifyState } from './verify-state';
import { aws } from '@microlambda/aws';

interface IShouldRunWorkspace {
  workspace: Workspace;
  hasCommand: boolean;
  affected: boolean;
  branch?: string;
  since?: string;
  cachedExecution?: ICmdExecution;
}

export const resolveDeltas = async (options: {
  cmd: string;
  fromRevision: string;
  args?: string | string[];
  env?: Record<string, string>;
  project?: Project;
  config?: IRootConfig;
  state?: State;
}): Promise<Array<IShouldRunWorkspace>> => {
  const projectRoot = options.project?.root ?? resolveProjectRoot();
  const project = options.project ?? (await Project.loadProject(projectRoot));
  const config = options.config ?? readConfig(projectRoot);
  const state = options.state ?? new State(config.state.table, config.defaultRegion);
  await verifyState(config);
  const shouldRun: Array<IShouldRunWorkspace> = [];
  for (const workspace of project.workspaces.values()) {
    if (!workspace.hasCommand(options.cmd)) {
      shouldRun.push({
        workspace,
        affected: false,
        hasCommand: false,
      });
      continue;
    }
    let sha1: string;
    let branch: string | undefined;
    if (options.fromRevision.match(/^[0-9a-f]{40}$/)) {
      sha1 = options.fromRevision;
    } else {
      const latestBranchExecution = await state.getLatestBranchExecution({
        branch: options.fromRevision,
        cmd: options.cmd,
        args: options.args ?? [],
        env: options.env ?? {},
        workspace: workspace.name,
      });
      sha1 = latestBranchExecution.sha1;
      if (sha1) {
        branch = options.fromRevision;
      }
    }
    if (!sha1) {
      shouldRun.push({
        workspace,
        affected: true,
        branch,
        hasCommand: true,
      });
      continue;
    }
    const cachedExecution = await state.getExecution({
      sha1,
      cmd: options.cmd,
      args: options.args ?? [],
      env: options.env ?? {},
      workspace: workspace.name,
    });
    if (!cachedExecution) {
      shouldRun.push({
        workspace,
        affected: true,
        hasCommand: true,
        since: sha1,
        branch,
      });
      continue;
    }
    const readChecksums = async (execution: ICmdExecution): Promise<ISourcesChecksums> => {
      try {
        const raw = await aws.s3.downloadBuffer(execution.bucket, execution.checksums, execution.region);
        if (!raw) {
          return {} as ISourcesChecksums;
        }
        return JSON.parse(raw.toString('utf-8'));
      } catch (e) {
        return {} as ISourcesChecksums;
      }
    };
    const checksums = new Checksums(workspace, options.cmd, options.args ?? [], options.env ?? {});
    const [currentChecksums, storedChecksum] = await Promise.all([
      checksums.calculate(),
      readChecksums(cachedExecution),
    ]);
    const areEquals = Checksums.compare(currentChecksums, storedChecksum);
    shouldRun.push({
      workspace,
      affected: !areEquals,
      hasCommand: true,
      since: sha1,
      branch,
      cachedExecution,
    });
  }
  return shouldRun;
};
