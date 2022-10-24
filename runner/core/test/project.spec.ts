import {SinonStub, stub} from "sinon";
import {Project, Workspace} from "../src";
import fastGlob from 'fast-glob';
import { join } from 'path';
import {mockedPackages} from "./mocks/project/package-json";
import { MilaError, MilaErrorCode } from '@microlambda/errors';
import { mockedCentipods } from './mocks/project/centipod-json';

describe('[class] Project', () => {
  let loadPackage: SinonStub;
  let loadConfig: SinonStub;
  let glob: SinonStub;
  const root = '/somewhere/on/filesystem';
  beforeEach(() => {
    loadPackage = stub(Workspace, 'loadPackage');
    loadConfig = stub(Workspace, 'loadConfig');
    glob = stub(fastGlob, 'sync');
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
    loadConfig.withArgs('test-project', root).resolves({ targets: {}});
    loadConfig.withArgs('@org/workspace-a', join(root, 'packages/workspace-a')).resolves({ targets: mockedCentipods.workspaceA.targets });
    loadConfig.withArgs('@org/workspace-b', join(root, 'packages/workspace-b')).resolves({ targets: mockedCentipods.workspaceB.targets });
    loadConfig.withArgs('@org/workspace-c', join(root, 'packages/workspace-c')).resolves({ targets: mockedCentipods.workspaceC.targets });
    loadConfig.withArgs('@org/api', join(root, 'api')).resolves({ targets: mockedCentipods.api.targets });
    loadConfig.withArgs('@org/app-a', join(root, 'apps/app-a')).resolves({ targets: mockedCentipods.appA.targets });
    loadConfig.withArgs('@org/app-b', join(root, 'apps/app-b')).resolves({ targets: mockedCentipods.appB.targets });
  });
  afterEach(() => {
    loadPackage.restore();
    loadConfig.restore();
    glob.restore();
  });
  describe('[static method] loadProject', () => {
    it('should correctly load project and its workspaces', async () => {
      const project = await Project.loadProject(root);
      expect(project.workspaces.size).toBe(6);
    });
    it('should throw if at least one workspace fails to load', async () => {
      loadConfig.withArgs('@org/workspace-c', join(root, 'packages/workspace-c')).rejects('Invalid package JSON');
      try {
        await Project.loadProject(root);
        fail('should throw');
      } catch (e) {
        expect(e).toBeTruthy();
        expect(e instanceof MilaError).toBe(true);
        expect((e as MilaError).code).toBe(MilaErrorCode.UNABLE_TO_LOAD_WORKSPACE);
      }
    });
  });
  describe('[method] getWorkspace', () => {
    it('should return a workspace by name if it exists', async () => {
      const project = await Project.loadProject(root);
      expect(project.getWorkspace('@org/workspace-a')).toBeTruthy();
    });
    it('should return null if not workspace with a such name exists', async () => {
      const project = await Project.loadProject(root);
      expect(project.getWorkspace('not-exists')).toBe(null);
    });
  });
  describe('[generator] leaves', () => {
    it('should yield all leaves', async () => {
      const project = await Project.loadProject(root);
      const leaves: Workspace[] = [];
      for (const leaf of project.leaves.values()) leaves.push(leaf)
      expect(leaves).toHaveLength(2);
      expect(leaves.some(l => l.name === '@org/workspace-c')).toBe(true);
      expect(leaves.some(l => l.name === '@org/workspace-a')).toBe(true);
    });
  });
  describe('[generator] roots', () => {
    it('should yield all roots', async () => {
      const project = await Project.loadProject(root);
      const roots: Workspace[] = [];
      for (const wks of project.roots.values()) roots.push(wks)
      expect(roots).toHaveLength(2);
      expect(roots.some(l => l.name === '@org/app-a')).toBe(true);
      expect(roots.some(l => l.name === '@org/app-b')).toBe(true);
    });
  });
  describe('[method] getTopologicallySortedWorkspaces', () => {
    it('should return workspaces in topological order', async () => {
      const project = await Project.loadProject(root);
      const workspaces = project.getTopologicallySortedWorkspaces();
      expect(workspaces).toHaveLength(6);
      expect(workspaces.indexOf(project.getWorkspace('@org/app-b') as Workspace)).toBeGreaterThan(workspaces.indexOf(project.getWorkspace('@org/api') as Workspace))
      expect(workspaces.indexOf(project.getWorkspace('@org/app-b') as Workspace)).toBeGreaterThan(workspaces.indexOf(project.getWorkspace('@org/workspace-a') as Workspace))
      expect(workspaces.indexOf(project.getWorkspace('@org/app-b') as Workspace)).toBeGreaterThan(workspaces.indexOf(project.getWorkspace('@org/workspace-b') as Workspace))
      expect(workspaces.indexOf(project.getWorkspace('@org/app-a') as Workspace)).toBeGreaterThan(workspaces.indexOf(project.getWorkspace('@org/workspace-a') as Workspace))
      expect(workspaces.indexOf(project.getWorkspace('@org/app-a') as Workspace)).toBeGreaterThan(workspaces.indexOf(project.getWorkspace('@org/workspace-c') as Workspace))
      expect(workspaces.indexOf(project.getWorkspace('@org/api') as Workspace)).toBeGreaterThan(workspaces.indexOf(project.getWorkspace('@org/workspace-b') as Workspace))
      expect(workspaces.indexOf(project.getWorkspace('@org/api') as Workspace)).toBeGreaterThan(workspaces.indexOf(project.getWorkspace('@org/workspace-a') as Workspace))
      expect(workspaces.indexOf(project.getWorkspace('@org/workspace-b') as Workspace)).toBeGreaterThan(workspaces.indexOf(project.getWorkspace('@org/workspace-a') as Workspace))
    });
    it('should stop to the target workspace if given', async () => {
      const project = await Project.loadProject(root);
      const workspaces = project.getTopologicallySortedWorkspaces([project.getWorkspace('@org/app-b')!]);
      const appA = workspaces.find((w) => w.name === '@org/app-a');
      expect(workspaces).toHaveLength(4);
      expect(workspaces.indexOf(project.getWorkspace('@org/app-b') as Workspace)).toBeGreaterThan(workspaces.indexOf(project.getWorkspace('@org/api') as Workspace))
      expect(workspaces.indexOf(project.getWorkspace('@org/app-b') as Workspace)).toBeGreaterThan(workspaces.indexOf(project.getWorkspace('@org/workspace-a') as Workspace))
      expect(workspaces.indexOf(project.getWorkspace('@org/app-b') as Workspace)).toBeGreaterThan(workspaces.indexOf(project.getWorkspace('@org/workspace-b') as Workspace))
      expect(workspaces.indexOf(project.getWorkspace('@org/api') as Workspace)).toBeGreaterThan(workspaces.indexOf(project.getWorkspace('@org/workspace-b') as Workspace))
      expect(workspaces.indexOf(project.getWorkspace('@org/api') as Workspace)).toBeGreaterThan(workspaces.indexOf(project.getWorkspace('@org/workspace-a') as Workspace))
      expect(workspaces.indexOf(project.getWorkspace('@org/workspace-b') as Workspace)).toBeGreaterThan(workspaces.indexOf(project.getWorkspace('@org/workspace-a') as Workspace))
    });
  });
  describe('[method] runCommand', () => {
    it.todo('should be tested');
  });
  describe('[method] publishAll', () => {
    it.todo('should be tested');
  });
});
