// @ts-ignore
import { Project, TargetsResolver, Workspace } from '../src';
// @ts-ignore
import { getProject } from './mocks/utils';
import { SinonStub, stub } from 'sinon';

describe('[class] TargetsResolver', () => {
  describe('[method] resolve', () => {
    let project: Project;
    beforeEach(async() => {
      project = await getProject();
    })
    it('should resolve all targets that have the command - parallel', async () => {
      const resolver = new TargetsResolver(project);
      const targets = await resolver.resolve('lint', {
        mode: 'parallel',
        force: false,
      });
      expect(targets).toHaveLength(1);
      expect(targets[0]).toHaveLength(6);
      expect(targets[0].filter((t) => t.hasCommand === true)).toHaveLength(4);
    });
    it.todo('should resolve all targets that have the command - parallel / affected')
    it('should resolve all targets that have the command - topological', async () => {
      const resolver = new TargetsResolver(project);
      const targets = await resolver.resolve('build', {
        mode: 'topological',
        force: false,
      });
      expect(targets).toHaveLength(4);
      expect(targets[0]).toHaveLength(2);
      expect(targets[0].some((t) => t.workspace.name === '@org/workspace-a')).toBe(true);
      expect(targets[0].some((t) => t.workspace.name === '@org/workspace-c')).toBe(true);
      expect(targets[1]).toHaveLength(2);
      expect(targets[1].some((t) => t.workspace.name === '@org/workspace-b')).toBe(true);
      expect(targets[1].some((t) => t.workspace.name === '@org/app-a')).toBe(true);
      expect(targets[2]).toHaveLength(1);
      expect(targets[2][0].workspace.name).toBe('@org/api');
      expect(targets[3]).toHaveLength(1);
      expect(targets[3][0].workspace.name).toBe('@org/app-b');
    });
    it.todo('should resolve all targets that have the command - topological & partial (--to)');
    it('should resolve all targets that have the command - topological & partial (no command)', async () => {
      const resolver = new TargetsResolver(project);
      const targets = await resolver.resolve('lint', {
        mode: 'topological',
        force: false,
      });
      expect(targets).toHaveLength(4);
      expect(targets[0]).toHaveLength(2);
      expect(targets[0].some((t) => t.workspace.name === '@org/workspace-b')).toBe(true);
      expect(targets[0].some((t) => t.workspace.name === '@org/workspace-c')).toBe(true);
      expect(targets[1]).toHaveLength(1);
      expect(targets[1][0].workspace.name).toBe('@org/workspace-a');
      expect(targets[2]).toHaveLength(2);
      expect(targets[2].some((t) => t.workspace.name === '@org/api')).toBe(true);
      expect(targets[2].some((t) => t.workspace.name === '@org/app-a')).toBe(true);
      expect(targets[3]).toHaveLength(1);
      expect(targets[3][0].workspace.name).toBe('@org/app-b');
    });
    it('should resolve all targets that have the command - topological & partial with "dependency gap"', async () => {
      const resolver = new TargetsResolver(project);
      const targets = await resolver.resolve('test', {
        mode: 'topological',
        force: false,
      });
      expect(targets).toHaveLength(4);
      expect(targets[0]).toHaveLength(2);
      expect(targets[0].some((t) => t.workspace.name === '@org/api')).toBe(true);
      expect(targets[0].some((t) => t.workspace.name === '@org/workspace-c')).toBe(true);
      expect(targets[1]).toHaveLength(1);
      expect(targets[1][0].workspace.name).toBe('@org/workspace-a');
      expect(targets[2]).toHaveLength(2);
      expect(targets[2].some((t) => t.workspace.name === '@org/workspace-b')).toBe(true);
      expect(targets[2].some((t) => t.workspace.name === '@org/app-a')).toBe(true);
      expect(targets[3]).toHaveLength(1);
      expect(targets[3][0].workspace.name).toBe('@org/app-b');
    });
    it('should resolve all targets with single --to - topological', async () => {
      const resolver = new TargetsResolver(project);
      const targets = await resolver.resolve('build', {
        mode: 'topological',
        to: [project.getWorkspace('@org/app-a')!],
        force: false,
      });
      expect(targets).toHaveLength(2);
      expect(targets[0]).toHaveLength(2);
      expect(targets[0].some((t) => t.workspace.name === '@org/workspace-a')).toBe(true);
      expect(targets[0].some((t) => t.workspace.name === '@org/workspace-c')).toBe(true);
      expect(targets[1]).toHaveLength(1);
      expect(targets[1][0].workspace.name).toBe('@org/app-a');
    });
    it('should resolve all targets with multiple --to - topological', async () => {
      const resolver = new TargetsResolver(project);
      const targets = await resolver.resolve('build', {
        mode: 'topological',
        to: [project.getWorkspace('@org/app-a')!, project.getWorkspace('@org/api')!],
        force: false,
      });
      expect(targets).toHaveLength(3);
      expect(targets[0]).toHaveLength(2);
      expect(targets[0].some((t) => t.workspace.name === '@org/workspace-a')).toBe(true);
      expect(targets[0].some((t) => t.workspace.name === '@org/workspace-c')).toBe(true);
      expect(targets[1]).toHaveLength(2);
      expect(targets[1].some((t) => t.workspace.name === '@org/app-a')).toBe(true);
      expect(targets[1].some((t) => t.workspace.name === '@org/workspace-b')).toBe(true);
      expect(targets[2]).toHaveLength(1);
      expect(targets[2][0].workspace.name).toBe('@org/api');
    });
    it.todo('should resolve all targets that have the command - topological / affected')
  });
});
