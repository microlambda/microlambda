import { stub } from 'sinon';
// @ts-ignore
import { Project, Workspace } from '../../src';
import fastGlob from 'fast-glob';
import { join } from 'path';
// @ts-ignore
import { mockedPackages } from './project/package-json';
import { mockedCentipods } from './project/centipod-json';

export const getProject = async (): Promise<Project> => {
  const root = '/somewhere/on/filesystem';
  const loadPackage = stub(Workspace, 'loadPackage');
  const loadConfig = stub(Workspace, 'loadConfig');
  const glob = stub(fastGlob, 'sync');
  loadPackage.rejects();
  loadConfig.rejects();
  glob.throws();
  glob.withArgs(join(root, 'packages/*/package.json')).returns([
    join(root, 'packages/workspace-a/package.json'),
    join(root, 'packages/workspace-b/package.json'),
    join(root, 'packages/workspace-c/package.json'),
  ]);
  glob.withArgs(join(root, 'api/package.json')).returns([
    join(root, 'api/package.json'),
  ]);
  glob.withArgs(join(root, 'apps/*/package.json')).returns([
    join(root, 'apps/app-a/package.json'),
    join(root, 'apps/app-b/package.json'),
  ]);
  loadPackage.withArgs(root).resolves(mockedPackages.root);
  loadPackage.withArgs(join(root, 'packages/workspace-a')).resolves(mockedPackages.workspaces.workspaceA);
  loadPackage.withArgs(join(root, 'packages/workspace-b')).resolves(mockedPackages.workspaces.workspaceB);
  loadPackage.withArgs(join(root, 'packages/workspace-c')).resolves(mockedPackages.workspaces.workspaceC);
  loadPackage.withArgs(join(root, 'api')).resolves(mockedPackages.workspaces.api);
  loadPackage.withArgs(join(root, 'apps/app-a')).resolves(mockedPackages.workspaces.appA);
  loadPackage.withArgs(join(root, 'apps/app-b')).resolves(mockedPackages.workspaces.appB);
  loadConfig.withArgs(root).resolves({});
  loadConfig.withArgs(join(root, 'packages/workspace-a')).resolves(mockedCentipods.workspaceA.targets);
  loadConfig.withArgs(join(root, 'packages/workspace-b')).resolves(mockedCentipods.workspaceB.targets);
  loadConfig.withArgs(join(root, 'packages/workspace-c')).resolves(mockedCentipods.workspaceC.targets);
  loadConfig.withArgs(join(root, 'api')).resolves(mockedCentipods.api.targets);
  loadConfig.withArgs(join(root, 'apps/app-a')).resolves(mockedCentipods.appA.targets);
  loadConfig.withArgs(join(root, 'apps/app-b')).resolves(mockedCentipods.appB.targets);
  const project = await Project.loadProject(root);
  loadPackage.restore();
  loadConfig.restore();
  glob.restore();
  return project;
};
