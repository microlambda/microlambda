import { resolveProjectRoot } from '@microlambda/utils';
import { Checksums, ISourcesChecksums, Project, Workspace } from '@microlambda/runner-core';
import { ICmdExecution, State, verifyState } from '@microlambda/remote-state';
import { getStateConfig, IStateConfig } from '@microlambda/config';
import { readConfig } from './read-config';
import { aws } from '@microlambda/aws';
import { IBaseLogger } from '@microlambda/types';

interface IShouldRunWorkspace {
  workspace: Workspace;
  hasCommand: boolean;
  affected: boolean;
  branch?: string;
  since?: string;
  cachedExecution?: ICmdExecution;
}

const readStateConfig = (projectRoot: string, account?: string): IStateConfig => {
  const rootConfig = readConfig(projectRoot);
  return getStateConfig(rootConfig, account);
};

export const isAffected = async (
  options: {
    cmd: string;
    fromRevision: string;
    workspace: string | Workspace;
    args?: string | string[];
    env?: Record<string, string>;
    project?: Project;
    config?: IStateConfig;
    account?: string;
    state?: State;
  },
  logger?: IBaseLogger,
): Promise<IShouldRunWorkspace> => {
  let workspace: Workspace | undefined;
  let projectRoot: string | undefined;
  if (typeof options.workspace === 'string') {
    const getProject = async (): Promise<Project> => {
      projectRoot = resolveProjectRoot();
      return options.project ?? (await Project.loadProject(projectRoot));
    };
    const project = options.project ?? (await getProject());
    workspace = project.workspaces.get(options.workspace);
  } else {
    workspace = options.workspace;
  }
  logger?.debug('is affected', workspace?.name, options.cmd);
  if (!workspace) {
    throw new Error('Unknown workspace: ' + options.workspace);
  }
  if (!workspace.hasCommand(options.cmd)) {
    logger?.debug('workspace has not the target impelmented');
    return {
      workspace,
      affected: false,
      hasCommand: false,
    };
  }
  let state = options.state;
  logger?.debug({ state });
  if (!state) {
    const projectRoot = options.project?.root ?? resolveProjectRoot();
    const config = options.config ?? readStateConfig(projectRoot, options.account);
    logger?.debug({ config, projectRoot });
    await verifyState(config, console);
    logger?.debug('state valid');
    state = options.state ?? new State(config.state.table, config.defaultRegion);
    logger?.debug('state resolved', config.state.table, config.defaultRegion);
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
    sha1 = latestBranchExecution?.sha1;
    if (sha1) {
      branch = options.fromRevision;
    }
  }
  if (!sha1) {
    logger?.debug('no previous execution found: affected = true');
    return {
      workspace,
      affected: true,
      branch,
      hasCommand: true,
    };
  }
  const cachedExecution = await state.getExecution({
    sha1,
    cmd: options.cmd,
    args: options.args ?? [],
    env: options.env ?? {},
    workspace: workspace.name,
  });
  logger?.debug('no previous execution found: affected = true');
  if (!cachedExecution) {
    return {
      workspace,
      affected: true,
      hasCommand: true,
      since: sha1,
      branch,
    };
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
  const [currentChecksums, storedChecksum] = await Promise.all([checksums.calculate(), readChecksums(cachedExecution)]);
  logger?.debug('previous execution found', sha1);
  const areEquals = Checksums.compare(currentChecksums, storedChecksum);
  logger?.debug('comparing cehcksums', { areEquals });
  return {
    workspace,
    affected: !areEquals,
    hasCommand: true,
    since: sha1,
    branch,
    cachedExecution,
  };
};

export const resolveDeltas = async (options: {
  cmd: string;
  fromRevision: string;
  args?: string | string[];
  env?: Record<string, string>;
  project?: Project;
  config?: IStateConfig;
  account?: string;
  state?: State;
}): Promise<Array<IShouldRunWorkspace>> => {
  const projectRoot = options.project?.root ?? resolveProjectRoot();
  const project = options.project ?? (await Project.loadProject(projectRoot));
  const config = options.config ?? readStateConfig(projectRoot, options.account);
  await verifyState(config);
  const shouldRun: Array<IShouldRunWorkspace> = [];
  const state = options.state ?? new State(config.state.table, config.defaultRegion);

  for (const workspace of project.workspaces.values()) {
    shouldRun.push(await isAffected({ ...options, workspace, state }));
  }
  return shouldRun;
};
