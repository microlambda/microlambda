import { command } from 'execa';
import { sync, Commit } from 'conventional-commits-parser';
import { CentipodError, CentipodErrorCode } from './error';
import { git } from './git';
import { Workspace } from './workspace';
import { Project } from './project';
import { inc, ReleaseType } from 'semver';
import { Publish, PublishActions } from './publish';

export const getSemanticReleaseTags = async (): Promise<string[]> => {
  const tags = await git.tags();
  return tags.all.filter((t) => t.startsWith('semantic-release@'));
}

export const hasSemanticReleaseTags = async (): Promise<boolean> => {
  const semanticReleaseTags = await getSemanticReleaseTags();
  return semanticReleaseTags.length > 0;
}

export const createSemanticReleaseTag = async (): Promise<void> => {
  await git.tag(`semantic-release@${Date.now()}`);
  await git.push();
};

interface ICoventionalCommit {
  hash: string;
  message: string,
  conventional: Commit;
  diffs?: string[];
  affected?: Workspace[];
}

export const semanticRelease  = async (project: Project, identifier?: string): Promise<Publish> => {
  const workspaces = project.workspaces;
  const semanticReleaseTags = await getSemanticReleaseTags();
  if (!semanticReleaseTags.length) {
    throw new CentipodError(CentipodErrorCode.NO_SEMANTIC_RELEASE_TAGS_FOUND, 'No semantic release tags found');
  }
  const latest = semanticReleaseTags.sort((t1, t2) => Number(t2.split('@')[1]) - Number(t1.split('@')[1]))[0];
  const log = await command(`git log --pretty=oneline --no-decorate ${latest}..`);
  const commits: Array<ICoventionalCommit> = [];
  const logLines = log.stdout.split('\n');
  if (logLines.length === 0 || (logLines.length === 1 && !logLines[0])) {
    throw new CentipodError(CentipodErrorCode.NOTHING_TO_DO, 'Nothing to do');
  }
  for (const line of logLines) {
    const hash = line.split(' ')[0];
    const revList = await command(`git rev-list --format=%B --max-count=1 ${hash}`)
    const message = revList.stdout.split('\n').slice(1).join('\n');
    const conventional = sync(message);
    commits.push({ hash, message, conventional });
  }
  const commitsAffecting: Map<Workspace, Array<ICoventionalCommit>> = new Map();
  for (const workspace of workspaces.values()) {
    commitsAffecting.set(workspace, []);
  }
  for (let i = 0; i < commits.length; ++i) {
    let rev1: string;
    let rev2: string;
    if (i === commits.length - 1) {
      rev1 = latest;
      rev2 = commits[i].hash;
    } else {
      rev1 = commits[i].hash;
      rev2 = commits[i + 1].hash;
    }
    const diff = await command(`git diff --name-only ${rev1} ${rev2}`);
    commits[i].diffs = diff.stdout.split('\n');
    commits[i].affected = [];
    for (const workspace of workspaces.values()) {
      if (await workspace.isAffected(rev1, rev2, ['**'], false)) {
        commits[i].affected?.push(workspace);
        commitsAffecting.get(workspace)?.push(commits[i]);
      }
    }
  }
  const bumps: Map<Workspace, ReleaseType | null> = new Map();
  const actions = new PublishActions();
  for (const [workspace, commits] of commitsAffecting.entries()) {
    const lastRelease = await workspace.getLastReleaseOnRegistry();
    const lastReleaseTag = await workspace.getLastReleaseTag();
    if (lastRelease !== lastReleaseTag) {
      actions.add({
        workspace,
        error: new CentipodError(CentipodErrorCode.TAG_AND_REGISTRY_VERSIONS_MISMATCH, `The last tag version ${lastReleaseTag} and the last version published in registry do not match.`),
      });
      continue;
    }
    const currentVersion = lastRelease;
    if (!commits.length) {
      bumps.set(workspace, null);
      actions.add({
        workspace,
        currentVersion,
        targetVersion: currentVersion,
        changed: false,
      })
      continue;
    }
    const shouldPatch = commits.some((c) => c.conventional.type === 'fix');
    const shouldMinor = commits.some((c) => c.conventional.type === 'feat');
    const shouldMajor = commits.some((c) => c.message.includes('BREAKING CHANGE'));
    const isLastCommitPrerelease = lastRelease.includes('-');

    if (!identifier && shouldMajor) {
      bumps.set(workspace, 'major');
    } else if (!identifier && shouldMinor) {
      bumps.set(workspace, 'minor');
    } else if (!identifier && shouldPatch) {
      bumps.set(workspace, 'patch');
    } else if (identifier && isLastCommitPrerelease) {
      bumps.set(workspace, 'prerelease');
    } else if (identifier && shouldMajor) {
      bumps.set(workspace, 'premajor');
    } else if (identifier && shouldMinor) {
      bumps.set(workspace, 'preminor');
    } else if (identifier && shouldPatch) {
      bumps.set(workspace, 'prepatch');
    }
    const bump = bumps.get(workspace);
    if (!bump) {
      actions.add({
        workspace,
        error: new CentipodError(CentipodErrorCode.CANNOT_DETERMINE_BUMP, 'Failed to determine version bump based on conventional commit messages'),
      });
      continue;
    }
    const targetVersion = inc(currentVersion, bump, identifier)
    if (!targetVersion) {
      actions.add({
        workspace,
        error: new CentipodError(CentipodErrorCode.CANNOT_BUMP_VERSION, 'Semver failed to increment version'),
      });
      continue;
    }
    actions.add({
      workspace,
      currentVersion,
      targetVersion,
      changed: true,
    });
  }
  const publisher = new Publish(project);
  publisher.setActions(actions);
  return publisher;
};

/*
SEMVER CHEATSHEET

Release on prerelease
> semver.inc('1.0.0-alpha.4', 'major')
'1.0.0'
> semver.inc('1.0.0-alpha.4', 'minor')
'1.0.0'
> semver.inc('1.0.0-alpha.4', 'patch')
'1.0.0'

Release on release
> semver.inc('1.0.0', 'patch')
'1.0.1'
> semver.inc('1.0.0', 'minor')
'1.1.0'
> semver.inc('1.0.0', 'major')
'2.0.0'

Prerelease on release
> semver.inc('1.0.0', 'premajor', 'rc')
'2.0.0-rc.0'
> semver.inc('1.0.0', 'preminor', 'rc')
'1.1.0-rc.0'
> semver.inc('1.0.0', 'prepatch', 'rc')
'1.0.1-rc.0'
> semver.inc('1.2.3', 'prerelease', 'rc')
'1.2.4-rc.0'

Prerelease on Prerelease
> semver.inc('1.0.0-alpha.4', 'premajor', 'rc')
'2.0.0-rc.0'
> semver.inc('1.0.0-alpha.4', 'prepatch', 'rc')
'1.0.1-rc.0'
> semver.inc('1.0.0-alpha.4', 'preminor', 'rc')
'1.1.0-rc.0'
> semver.inc('1.0.0-alpha.4', 'prerelease', 'rc')
'1.0.0-rc.0'
 */
