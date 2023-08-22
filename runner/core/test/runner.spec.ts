import {getProject} from './mocks/utils';
import {SinonStub, stub} from 'sinon';
import {Project, RunCommandEventEnum, Runner, RunOptions, TargetsResolver, Workspace} from '../src';
import {
  expectObservableV2, mockSourcesChange,
  ObservableEvent,
  resolveAfter,
  stubKill,
  stubRun,
  stubRunV2
} from './utils/runner-observable';
import {Watcher} from "../src/watcher";
import {OrderedTargets} from "../src";

describe('[class] Runner', () => {
  let project: Project;
  let stubs: {
    run?: SinonStub,
    isDaemon?: SinonStub,
    invalidate?: SinonStub,
    targets?: SinonStub,
    watch?: SinonStub,
    loadPackage?: SinonStub,
    loadConfig?: SinonStub,
    kill?: SinonStub,
    glob?: SinonStub,
  } = {};
  beforeEach(async() => {
    project = await getProject(stubs);
    stubs.invalidate = stub(Workspace.prototype, 'invalidateCache');
    stubs.isDaemon = stub(Workspace.prototype, 'isDaemon');
    stubs.kill = stub(Workspace.prototype, 'kill');
    stubs.kill.rejects();
    stubs.isDaemon.returns(false);
    stubs.isDaemon.withArgs('start').returns(true);
    stubs.invalidate.returns(resolveAfter(null, 15));
    stubs.run = stub(Workspace.prototype, 'run');
    stubs.targets = stub(TargetsResolver.prototype, 'resolve');
    stubs.watch = stub(Watcher.prototype, 'watch');
  })
  afterEach(() => {
    Object.values(stubs).forEach((stub) => stub.restore());
  });
  describe('[method] runCommand', () => {
    it('should run command in all workspace at once - parallel', async () => {
      stubs.targets?.returns(resolveAfter([
        [
          { workspace: project.workspaces.get('@org/workspace-a')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/workspace-b')!, hasCommand: false },
          { workspace: project.workspaces.get('@org/workspace-c')!, hasCommand: false },
          { workspace: project.workspaces.get('@org/app-a')!, hasCommand: false },
          { workspace: project.workspaces.get('@org/app-b')!, hasCommand: false },
          { workspace: project.workspaces.get('@org/api')!, hasCommand: true },
        ]
      ], 12));
      const options: RunOptions = {
        cmd: 'lint',
        mode: 'parallel',
        force: false,
      };
      stubRunV2(stubs.run, new Map([
        ['@org/workspace-a', [{ resolve: true, delay: 14 }]],
        ['@org/api', [{ resolve: true, delay: 23 }]],
      ]));
      try {
        const runner = new Runner(project, 4);
        const execution$ = runner.runCommand(options);
        await expectObservableV2(
          Date.now(),
          execution$,
          [
            [
              { type: RunCommandEventEnum.TARGETS_RESOLVED },
            ],
            [
              { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-a' },
              { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/api' },
              { type: RunCommandEventEnum.NODE_SKIPPED, workspace: '@org/workspace-c' },
              { type: RunCommandEventEnum.NODE_SKIPPED, workspace: '@org/workspace-b' },
              { type: RunCommandEventEnum.NODE_SKIPPED, workspace: '@org/app-a' },
              { type: RunCommandEventEnum.NODE_SKIPPED, workspace: '@org/app-b' },
            ],
            [
              { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-a' },
              { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/api' },
            ],
          ],
          ObservableEvent.COMPLETE,
        );
      } catch (e) {
        expect(e).toBeFalsy();
      }
    });
    it('should run command in all workspace even if it fails for some workspace - parallel', async () => {
      stubs.targets?.returns(resolveAfter([
        [
          { workspace: project.workspaces.get('@org/workspace-a')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/workspace-b')!, hasCommand: false },
          { workspace: project.workspaces.get('@org/workspace-c')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-a')!, hasCommand: false },
          { workspace: project.workspaces.get('@org/app-b')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/api')!, hasCommand: true },
        ]
      ], 12));
      const options: RunOptions = {
        cmd: 'lint',
        mode: 'parallel',
        force: false,
      };
      stubRunV2(stubs.run, new Map([
        ['@org/workspace-a', [ { resolve: true, options, delay: 14 } ]],
        ['@org/workspace-c', [ { resolve: false, options, delay: 7, error: new Error('Unexpected') } ]],
        ['@org/app-b', [ { resolve: true, options, delay: 13 } ]],
        ['@org/api', [ { resolve: true, options, delay: 23 } ]],
      ]));
      try {
        const runner = new Runner(project, 4);
        const execution$ = runner.runCommand(options);
        await expectObservableV2(Date.now(), execution$, [
          [
            { type: RunCommandEventEnum.TARGETS_RESOLVED },
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-a' },
            { type: RunCommandEventEnum.NODE_SKIPPED, workspace: '@org/workspace-b' },
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-c' },
            { type: RunCommandEventEnum.NODE_SKIPPED, workspace: '@org/app-a' },
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-b' },
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/api' },
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-a' },
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/workspace-c' },
            { type: RunCommandEventEnum.NODE_ERRORED, workspace: '@org/workspace-c' },
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-b' },
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/api' },
          ],
        ], ObservableEvent.COMPLETE);
      } catch (e) {
        expect(e).toBeFalsy();
      }
    });
    it('should run command from leaves to roots - topological', async () => {
      stubs.targets?.returns(resolveAfter([
        [
          { workspace: project.workspaces.get('@org/workspace-a')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/workspace-c')!, hasCommand: true },
        ],
        [
          { workspace: project.workspaces.get('@org/workspace-b')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-a')!, hasCommand: true },
        ],
        [
          { workspace: project.workspaces.get('@org/api')!, hasCommand: true },
        ],
        [
          { workspace: project.workspaces.get('@org/app-b')!, hasCommand: true },
        ]
      ], 12));
      const options: RunOptions = {
        cmd: 'build',
        mode: 'topological',
        force: false,
      };
      stubRunV2(stubs.run, new Map([
        ['@org/workspace-a', [ { resolve: true, options, delay: 14 } ]],
        ['@org/workspace-b', [ { resolve: true, options, delay: 13 } ]],
        ['@org/workspace-c', [ { resolve: true, options, delay: 7 } ]],
        ['@org/app-a', [ { resolve: true, options, delay: 23 } ]],
        ['@org/app-b', [ { resolve: true, options, delay: 12 } ]],
        ['@org/api', [ { resolve: true, options, delay: 4 } ]],
      ]));
      try {
        const runner = new Runner(project, 4);
        const execution$ = runner.runCommand(options);
        await expectObservableV2(Date.now(), execution$, [
          [
            { type: RunCommandEventEnum.TARGETS_RESOLVED }, // +12ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-a' }, // +12ms
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-c' }, // +12ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-c' }, // +19ms
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/app-a' }, // +20ms
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/workspace-b' }, // +20ms
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/app-b' }, // +20ms
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/api' }, // +20ms
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-a' }, // +26ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-a' }, // +12ms
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-b' }, // +12ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-a' }, // +12ms
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-b' }, // +12ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/api' }, // +12ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/api' }, // +12ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-b' }, // +12ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-b' }, // +12ms
          ],
        ], ObservableEvent.COMPLETE);
      } catch (e) {
        expect(e).toBeFalsy();
      }
    });
    it('should terminate and invalidate cache of subsequent workspaces if a command fail in a workspace - topological', async () => {
      stubs.targets?.returns(resolveAfter([
        [
          { workspace: project.workspaces.get('@org/workspace-a')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/workspace-c')!, hasCommand: true },
        ],
        [
          { workspace: project.workspaces.get('@org/workspace-b')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-a')!, hasCommand: true },
        ],
        [
          { workspace: project.workspaces.get('@org/api')!, hasCommand: true },
        ],
        [
          { workspace: project.workspaces.get('@org/app-b')!, hasCommand: true },
        ]
      ], 12));
      const options: RunOptions = {
        cmd: 'build',
        mode: 'topological',
        force: false,
      };
      stubRunV2(stubs.run, new Map([
        ['@org/workspace-a', [ { resolve: true, options, delay: 14, fromCache: true } ]],
        ['@org/workspace-b', [ { resolve: true, options, delay: 13, fromCache: true } ]],
        ['@org/workspace-c', [ { resolve: true, options, delay: 7, fromCache: true } ]],
        ['@org/app-a', [ { resolve: false, options, delay: 23 } ]],
        ['@org/app-b', [ { resolve: true, options, delay: 4 } ]],
        ['@org/api', [ { resolve: true, options, delay: 12 } ]],
      ]));
      try {
        const runner = new Runner(project, 4);
        const execution$ = runner.runCommand(options);
        await expectObservableV2(Date.now(), execution$, [
          [
            { type: RunCommandEventEnum.TARGETS_RESOLVED }, // +12ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-a' }, // +12ms
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-c' }, // +12ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-c' }, // +19ms
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-a' }, // +26ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-a' }, // +12ms
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-b' }, // +12ms
          ],
          [
            { type: RunCommandEventEnum.NODE_ERRORED, workspace: '@org/app-a' }, // +12ms
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/app-a' }, // +12ms
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/app-b' }, // +12ms
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/api' }, // +12ms
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-b' }, // +12ms
          ],
        ], ObservableEvent.ERROR);

      } catch (e) {
        expect(e).toBeFalsy();
      }
    });
    it('should invalidate cache of subsequent workspaces if a command must be re-run in a workspace - topological', async () => {
      stubs.targets?.returns(resolveAfter([
        [
          { workspace: project.workspaces.get('@org/workspace-a')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/workspace-c')!, hasCommand: true },
        ],
        [
          { workspace: project.workspaces.get('@org/workspace-b')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-a')!, hasCommand: true },
        ],
        [
          { workspace: project.workspaces.get('@org/api')!, hasCommand: true },
        ],
        [
          { workspace: project.workspaces.get('@org/app-b')!, hasCommand: true },
        ]
      ], 12));
      const options: RunOptions = {
        cmd: 'build',
        mode: 'topological',
        force: false,
      };
      stubRunV2(stubs.run, new Map([
        ['@org/workspace-a', [ { resolve: true, options, delay: 4, fromCache: true } ]],
        ['@org/workspace-c', [ { resolve: true, options, delay: 2, fromCache: true } ]],
        ['@org/workspace-b', [ { resolve: true, options, delay: 2, fromCache: true } ]],
        ['@org/app-a', [ { resolve: true, options, delay: 23 } ]],
        ['@org/api', [ { resolve: true, options, delay: 12 } ]],
        ['@org/app-b', [ { resolve: true, options, delay: 4 } ]],
      ]));
      try {
        const runner = new Runner(project, 4);
        const execution$ = runner.runCommand(options);
        await expectObservableV2(Date.now(), execution$, [
          [
            { type: RunCommandEventEnum.TARGETS_RESOLVED }, // +12ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-a' }, // +12ms
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-c' }, // +12ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-c' }, // +14ms
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-a' }, // +16ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-a' }, // +16ms
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-b' }, // +16ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-b' }, // +18ms
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-a' }, // +39ms
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/app-b' }, // +15ms
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/api' }, // +15ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/api' }, // +12ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/api' }, // +12ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-b' }, // +12ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-b' }, // +12ms
          ],
        ], ObservableEvent.COMPLETE);
      } catch (e) {
        expect(e).toBeFalsy();
      }
    });
    it('should terminate on cache invalidation error  - parallel', async () => {
      stubs.targets?.returns(resolveAfter([
        [
          { workspace: project.workspaces.get('@org/workspace-a')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/workspace-b')!, hasCommand: false },
          { workspace: project.workspaces.get('@org/workspace-c')!, hasCommand: false },
          { workspace: project.workspaces.get('@org/app-a')!, hasCommand: false },
          { workspace: project.workspaces.get('@org/app-b')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/api')!, hasCommand: true },
        ]
      ], 12));
      stubs.invalidate?.rejects();
      const options: RunOptions = {
        cmd: 'lint',
        mode: 'parallel',
        force: false,
      };
      stubRunV2(stubs.run, new Map([
        ['@org/workspace-a', [ { resolve: true, options, delay: 14 } ]],
        ['@org/api', [ { resolve: false, options, delay: 23 } ]],
        ['@org/app-b', [ { resolve: true, options, delay: 8 } ]],
      ]));
      try {
        const runner = new Runner(project, 4);
        const execution$ = runner.runCommand(options);
        await expectObservableV2(Date.now(), execution$, [
          [
            { type: RunCommandEventEnum.TARGETS_RESOLVED }, // +12ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-a' }, // +12ms
            { type: RunCommandEventEnum.NODE_SKIPPED, workspace: '@org/workspace-b' }, // +12ms
            { type: RunCommandEventEnum.NODE_SKIPPED, workspace: '@org/workspace-c' }, // +12ms
            { type: RunCommandEventEnum.NODE_SKIPPED, workspace: '@org/app-a' }, // +12ms
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-b' }, // +12ms
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/api' }, // +12ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-a' }, // +14ms
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-b' }, // +16ms
            { type: RunCommandEventEnum.NODE_ERRORED, workspace: '@org/api' }, // +16ms
            { type: RunCommandEventEnum.ERROR_INVALIDATING_CACHE, workspace: '@org/api' }, // +16ms
          ],
        ], ObservableEvent.ERROR);
      } catch (e) {
        expect(e).toBeFalsy();
      }
    });
    it('should terminate on cache invalidation error  - topological', async () => {
      stubs.targets?.returns(resolveAfter([
        [
          { workspace: project.workspaces.get('@org/workspace-a')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/workspace-c')!, hasCommand: true },
        ],
        [
          { workspace: project.workspaces.get('@org/workspace-b')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-a')!, hasCommand: true },
        ],
        [
          { workspace: project.workspaces.get('@org/api')!, hasCommand: true },
        ],
        [
          { workspace: project.workspaces.get('@org/app-b')!, hasCommand: true },
        ]
      ], 12));
      const options: RunOptions = {
        cmd: 'build',
        mode: 'topological',
        force: false,
      };
      stubRunV2(stubs.run, new Map([
        ['@org/workspace-a', [ { resolve: true, options, delay: 14, fromCache: true } ]],
        ['@org/workspace-c', [ { resolve: true, options, delay: 7, fromCache: true } ]],
        ['@org/workspace-b', [ { resolve: true, options, delay: 13, fromCache: true } ]],
        ['@org/app-a', [ { resolve: false, options, delay: 23 } ]],
        ['@org/app-b', [ { resolve: true, options, delay: 12 } ]],
        ['@org/api', [ { resolve: true, options, delay: 4 } ]],
      ]));
      stubs.invalidate?.onCall(0).resolves();
      stubs.invalidate?.onCall(1).rejects();
      stubs.invalidate?.onCall(2).resolves();
      try {
        const runner = new Runner(project, 4);
        const execution$ = runner.runCommand(options);
        await expectObservableV2(Date.now(), execution$, [
          [
            { type: RunCommandEventEnum.TARGETS_RESOLVED }, // +12ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-a' }, // +12ms
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-c' }, // +12ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-c' }, // +14ms
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-a' }, // +16ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-a' }, // +16ms
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-b' }, // +16ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-b' }, // +18ms
            { type: RunCommandEventEnum.NODE_ERRORED, workspace: '@org/app-a' }, // +39ms
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/app-a' }, // +15ms
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/app-b' }, // +15ms
            { type: RunCommandEventEnum.ERROR_INVALIDATING_CACHE, workspace: '@org/api' }, // +15ms
          ],
        ], ObservableEvent.ERROR);
      } catch (e) {
        expect(e).toBeFalsy();
      }
    });
  });
  describe('[method] runCommand (watch mode)', () => {
    it('should handle single-interruption in running step and when idle - [parallel]', async () => {
      const targets: OrderedTargets = [
        [
          { workspace: project.workspaces.get('@org/workspace-a')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/workspace-b')!, hasCommand: false },
          { workspace: project.workspaces.get('@org/workspace-c')!, hasCommand: false },
          { workspace: project.workspaces.get('@org/app-a')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-b')!, hasCommand: false },
          { workspace: project.workspaces.get('@org/api')!, hasCommand: true },
        ]
      ];
      stubs.targets?.returns(resolveAfter(targets, 12));

      const options: RunOptions = {
        cmd: 'lint',
        mode: 'parallel',
        force: false,
        args: [],
        env: {},
        watch: true,
        debounce: 8,
      };
      stubs.watch?.returns(mockSourcesChange(project, targets, [
        { workspaceNames: ['@org/api'], delay: 150},
        { workspaceNames: ['@org/app-a'], delay: 450},
      ]));
      stubRunV2(stubs.run, new Map([
        ['@org/workspace-a', [
          { resolve: true, delay: 80 },
        ]],
        ['@org/api', [
          { resolve: true, killed: 150, delay: 200 },
          { resolve: true, delay: 90 },
        ]],
        ['@org/app-a', [
          { resolve: true, delay: 120 },
          { resolve: true, delay: 110 },
        ]]
      ]));
      stubKill(stubs.kill, new Map([
        ['@org/app-a', [{cmd: 'lint', delay: 0, pids: []} ]],
        ['@org/api', [{cmd: 'lint', delay: 2, pids: [2344]} ]],
      ]))
      try {
        const runner = new Runner(project, 4);
        const execution$ = runner.runCommand(options);
        await expectObservableV2(
          Date.now(),
          execution$,
          [
            [
              { type: RunCommandEventEnum.TARGETS_RESOLVED },
            ],
            [
              { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-a' },
              { type: RunCommandEventEnum.NODE_SKIPPED, workspace: '@org/workspace-b' },
              { type: RunCommandEventEnum.NODE_SKIPPED, workspace: '@org/workspace-c' },
              { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-a' },
              { type: RunCommandEventEnum.NODE_SKIPPED, workspace: '@org/app-b' },
              { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/api' },
            ],
            [
              { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-a' },
            ],
            [
              { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-a' },
              { type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/api' },
            ],
            [
              { type: RunCommandEventEnum.NODE_INTERRUPTING, workspace: '@org/api' },
            ],
            [
              { type: RunCommandEventEnum.NODE_INTERRUPTED, workspace: '@org/api' },
            ],
            [
              { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/api' },
            ],
            [
              { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/api' },
            ],
            [
              { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/api' },
            ],
            [
              { type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/app-a' },
            ],
            [
              { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/app-a' },
            ],
            [
              { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-a' },
            ],
            [
              { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-a' },
            ],
          ],
          400,
        )
      } catch (e) {
        expect(e).toBeFalsy();
      }
    });
    it('should do nothing if impacted process has not started yet - [parallel]', async () => {
      const targets = [
        [
          { workspace: project.workspaces.get('@org/workspace-a')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/workspace-b')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/workspace-c')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-a')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-b')!, hasCommand: false },
          { workspace: project.workspaces.get('@org/api')!, hasCommand: true },
        ]
      ];
      stubs.targets?.returns(resolveAfter(targets, 10));
      stubs.watch?.returns(mockSourcesChange(project, targets, [
        { workspaceNames: ['@org/app-a'], delay: 50},
        { workspaceNames: ['@org/api'], delay: 150},
      ]));
      const options: RunOptions = {
        cmd: 'lint',
        mode: 'parallel',
        force: false,
        args: [],
        env: {},
        watch: true,
        debounce: 8,
      };
      stubRunV2(stubs.run, new Map([
        ['@org/workspace-a', [ { resolve: true, options, delay: 80 }]],
        ['@org/workspace-b', [{ resolve: true, options, delay: 100 }]],
        ['@org/workspace-c', [{ resolve: true, options, delay: 100 }]],
        ['@org/app-a', [{ resolve: true, options, delay: 120 }]],
        ['@org/api', [{ resolve: true, options, delay: 100 }]],
      ]));
      try {
        const runner = new Runner(project, 2);
        const execution$ = runner.runCommand(options);
        await expectObservableV2(Date.now(), execution$, [
          [
            { type: RunCommandEventEnum.TARGETS_RESOLVED },
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-a' },
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-b' },
          ],
          [
            { type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/app-a' },
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-a' },
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-c' },
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-b' },
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-a' },
          ],
          [
            { type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/api' },
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-c' },
          ],
          [
            { type: RunCommandEventEnum.NODE_SKIPPED, workspace: '@org/app-b' },
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/api' },
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-a' },
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/api' },
          ],
        ], 200)
      } catch (e) {
        expect(e).toBeFalsy();
      }
    });
    it('should do nothing if impacted target is not affected - [parallel]', async () => {
      const targets = [
        [
          { workspace: project.workspaces.get('@org/workspace-a')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/workspace-b')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/workspace-c')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-a')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-b')!, hasCommand: false },
          { workspace: project.workspaces.get('@org/api')!, hasCommand: false },
        ]
      ];

      stubs.targets?.returns(resolveAfter(targets, 12));
      stubs.watch?.returns(mockSourcesChange(project, targets, [
        { workspaceNames: ['@org/api'], delay: 30},
      ]));
      const options: RunOptions = {
        cmd: 'lint',
        mode: 'parallel',
        force: false,
        args: [],
        env: {},
        watch: true,
        debounce: 8,
      };
      stubRunV2(stubs.run, new Map([
        ['@org/workspace-a', [ { resolve: true, options, delay: 100 } ]],
        ['@org/workspace-b', [ { resolve: true, options, delay: 100 } ]],
        ['@org/workspace-c', [ { resolve: true, options, delay: 100 } ]],
        ['@org/app-a', [ { resolve: true, options, delay: 100 } ]],
      ]));
      try {
        const runner = new Runner(project, 8);
        const execution$ = runner.runCommand(options);
        await expectObservableV2(Date.now(), execution$, [
          [
            { type: RunCommandEventEnum.TARGETS_RESOLVED }, // +12ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-a' }, // +12ms
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-b' }, // +12ms
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-c' }, // +12ms
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-a' }, // +12ms
            { type: RunCommandEventEnum.NODE_SKIPPED, workspace: '@org/app-b' }, // +12ms
            { type: RunCommandEventEnum.NODE_SKIPPED, workspace: '@org/api' }, // +12ms
          ],
          [
            { type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/api' }, // +12ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-a' }, // +14ms
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-b' }, // +16ms
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-c' }, // +16ms
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-a' }, // +16ms
          ],
        ], 100);
      } catch (e) {
        expect(e).toBeFalsy();
      }
    });
    it('should handle correctly multiple interruption - [parallel]', async () => {
      const targets = [
        [
          { workspace: project.workspaces.get('@org/workspace-a')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/workspace-b')!, hasCommand: false },
          { workspace: project.workspaces.get('@org/workspace-c')!, hasCommand: false },
          { workspace: project.workspaces.get('@org/app-a')!, hasCommand: false },
          { workspace: project.workspaces.get('@org/app-b')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/api')!, hasCommand: true },
        ]
      ];
      stubs.targets?.returns(resolveAfter(targets, 5));
      stubs.watch?.returns(mockSourcesChange(project, targets, [
        // During First round
        { workspaceNames: ['@org/api'], delay: 65},
        { workspaceNames: ['@org/workspace-a', '@org/workspace-c'], delay: 130},
        // During first recompile
        { workspaceNames: ['@org/api', '@org/workspace-b'], delay: 350},
        { workspaceNames: ['@org/workspace-c'], delay: 400},
        // After first recompile
        { workspaceNames: ['@org/app-a', '@org/workspace-a', '@org/workspace-c'], delay: 700},
        { workspaceNames: ['@org/app-b'], delay:750},
      ]));

      stubKill(stubs.kill, new Map([
        ['@org/workspace-a', [{ cmd: 'lint', delay: 10, pids: [2345] }]],
        ['@org/api', [{ cmd: 'lint', delay: 21, pids: [2345] }, { cmd: 'lint', delay: 22, pids: [2345] }]],
      ]));

      const options: RunOptions = {
        cmd: 'lint',
        mode: 'parallel',
        force: false,
        args: [],
        env: {},
        watch: true,
        debounce: 20,
      };

      stubRunV2(stubs.run, new Map([
        ['@org/workspace-a', [
          { resolve: true, delay: 200, killed: 130 },
          { resolve: true, delay: 220 },
          { resolve: true, delay: 126 },
        ]],
        ['@org/app-b', [
          { resolve: true, delay: 250 },
          { resolve: true, delay: 123 },
        ]],
        ['@org/api', [
          { resolve: true, delay: 200, killed: 65 },
          { resolve: true, delay: 240, killed: 350 - 250 },
          { resolve: true, delay: 220 },
        ]],
      ]));
      try {
        const runner = new Runner(project, 8);
        const execution$ = runner.runCommand(options);
        await expectObservableV2(Date.now(), execution$, [
          [
            {type: RunCommandEventEnum.TARGETS_RESOLVED}, // +5ms
          ],
          [
            {type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-a'}, // +5ms (-> killed)
            {type: RunCommandEventEnum.NODE_SKIPPED, workspace: '@org/workspace-b'}, // +5ms
            {type: RunCommandEventEnum.NODE_SKIPPED, workspace: '@org/workspace-c'}, // +5ms
            {type: RunCommandEventEnum.NODE_SKIPPED, workspace: '@org/app-a'}, // +5ms
            {type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-b'}, // +5ms (-> +255ms)
            {type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/api'}, // +5ms (-> killed)
          ],
          [
            {type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/api'}, // +65ms
            {type: RunCommandEventEnum.NODE_INTERRUPTING, workspace: '@org/api'}, // +65ms
          ],
          [
            {type: RunCommandEventEnum.NODE_INTERRUPTED, workspace: '@org/api'}, // +85ms
          ],
          [
            {type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/api'}, // +87ms (-> killed)
          ],
          [
            {type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/api'}, // +87ms (-> killed)
          ],
          [
            {type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/workspace-a'}, // +130ms
            {type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/workspace-c'}, // +130ms
            {type: RunCommandEventEnum.NODE_INTERRUPTING, workspace: '@org/workspace-a'}, // +130ms
          ],
          [
            {type: RunCommandEventEnum.NODE_INTERRUPTED, workspace: '@org/workspace-a'}, // +140ms
          ],
          [
            {type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/workspace-a'}, // +140ms
          ],
          [
            {type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-a'}, // +140ms (-> +360ms)
          ],
          [
            {type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-b'}, // +250ms
          ],
          [
            {type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/api'}, // +350ms
            {type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/workspace-b'}, // +350ms
            {type: RunCommandEventEnum.NODE_INTERRUPTING, workspace: '@org/api'}, // +350ms
            {type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-a'}, // +360ms (<- + 146ms)
          ],
          [
            {type: RunCommandEventEnum.NODE_INTERRUPTED, workspace: '@org/api'}, // +370ms
          ],
          [
            {type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/api'}, // +371ms (-> 590ms)
          ],
          [
            {type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/workspace-c'}, // +400ms
          ],
          [
            {type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/api'}, // +590ms
          ],
          [
            {type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/app-a'}, // +600ms
            {type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/workspace-a'}, // +600ms
            {type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/workspace-c'}, // +600ms
          ],
          [
            {type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/workspace-a'},
          ],
          [
            {type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-a'},
          ],
          [
            {type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/app-b'},
          ],
          [
            {type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/app-b'},
          ],
          [
            {type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-b'},
          ],
          [
            {type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-a'},
            {type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-b'},
          ],
        ], 500);
      } catch (e) {
        expect(e).toBeFalsy();
      }
    });
    it('should handle correctly errored node - [parallel]', async () => {
      const targets = [
        [
          { workspace: project.workspaces.get('@org/workspace-a')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/workspace-b')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/workspace-c')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-a')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-b')!, hasCommand: false },
          { workspace: project.workspaces.get('@org/api')!, hasCommand: false },
        ]
      ]
      stubs.targets?.returns(resolveAfter(targets, 10));
      stubs.watch?.returns(mockSourcesChange(project, targets, [
        { workspaceNames: ['@org/workspace-a'], delay: 250},
        { workspaceNames: ['@org/app-a'], delay: 600},
        { workspaceNames: ['@org/app-a'], delay: 750},
      ]));
      const options: RunOptions = {
        cmd: 'lint',
        mode: 'parallel',
        force: false,
        args: [],
        env: {},
        watch: true,
        debounce: 8,
      };
      stubRunV2(stubs.run, new Map([
        ['@org/workspace-a', [
          { resolve: false, options, delay: 100, error: new Error('Mocked') },
          { resolve: true, options, delay: 100 },
        ]],
        ['@org/workspace-b', [
          { resolve: true, options, delay: 400 },
        ]],
        ['@org/workspace-c', [
          { resolve: true, options, delay: 120 },
        ]],
        ['@org/app-a', [
          { resolve: true, options, delay: 100 },
          { resolve: false, options, delay: 100, error: new Error('Mocked') },
          { resolve: true, options, delay: 100 },
        ]],
      ]));
      try {
        const runner = new Runner(project, 8);
        const execution$ = runner.runCommand(options);
        await expectObservableV2(Date.now(), execution$, [
          [
            { type: RunCommandEventEnum.TARGETS_RESOLVED}, // +10ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-a'}, // +10ms
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-b'}, // +10ms
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-c'}, // +10ms
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-a'}, // +10ms
            { type: RunCommandEventEnum.NODE_SKIPPED, workspace: '@org/app-b'}, // +10ms
            { type: RunCommandEventEnum.NODE_SKIPPED, workspace: '@org/api'}, // +10ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-a'}, // +100ms
            { type: RunCommandEventEnum.NODE_ERRORED, workspace: '@org/workspace-a'}, // +100ms
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/workspace-a'}, // +110ms
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-c'}, // +120ms
          ],
          [
            { type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/workspace-a'}, // +250ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-a'}, // +350ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-a'}, // +350ms
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-b'}, // +400ms
          ],
          [
            { type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/app-a'}, // +600ms
          ],
          [
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/app-a'}, // +600ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-a'}, // +600ms
          ],
          [
            { type: RunCommandEventEnum.NODE_ERRORED, workspace: '@org/app-a'}, // +700ms
          ],
          [
            { type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/app-a'}, // +750ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-a'}, // +600ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-a'}, // +850ms

          ]
        ], 400);
      } catch (e) {
        expect(e).toBeFalsy();
      }
    });
    it('should handle multiple file changes within a step execution - [parallel]', async () => {
      const targets = [
        [
          { workspace: project.workspaces.get('@org/workspace-a')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/workspace-b')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/workspace-c')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-a')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-b')!, hasCommand: false },
          { workspace: project.workspaces.get('@org/api')!, hasCommand: false },
        ]
      ];
      stubs.targets?.returns(resolveAfter(targets, 8));
      stubs.watch?.returns(mockSourcesChange(project, targets, [
        { workspaceNames: ['@org/workspace-a'], delay: 70},
        { workspaceNames: ['@org/app-a'], delay: 100},
        { workspaceNames: ['@org/app-a', '@org/workspace-b'], delay: 170},
      ]));
      stubRunV2(stubs.run, new Map([
        ['@org/workspace-a', [
          { resolve: true, delay: 30 },
          { resolve: true, delay: 70 },
        ]],
        ['@org/workspace-b', [
          { resolve: true, delay: 250, killed: 140 },
          { resolve: true, delay: 110 },
        ]],
        ['@org/workspace-c', [
          { resolve: true, delay: 220 },
        ]],
        ['@org/app-a', [
          { resolve: true, delay: 130, killed: 90 },
          { resolve: true, delay: 150, killed: 20 },
          { resolve: true, delay: 150 },
        ]],
      ]));

      stubKill(stubs.kill, new Map([
        ['@org/workspace-b', [
          { cmd: 'lint', delay: 25, pids: [123] },
        ]],
        ['@org/app-a', [
          { cmd: 'lint', delay: 20, pids: [123] },
          { cmd: 'lint', delay: 15, pids: [123] },
        ]],
      ]));

      const options: RunOptions = {
        cmd: 'lint',
        mode: 'parallel',
        force: false,
        args: [],
        env: {},
        watch: true,
        debounce: 8,
      };

      try {
        const runner = new Runner(project, 8);
        const execution$ = runner.runCommand(options);
        await expectObservableV2(Date.now(), execution$, [
          [
            { type: RunCommandEventEnum.TARGETS_RESOLVED }, // +10ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-a' }, // +10ms (-> 40ms)
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-b' }, // +10ms (killed @ 150ms)
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-c' }, // +10ms (-> 220ms)
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-a' }, // +10ms (-> killed @ 100ms)
            { type: RunCommandEventEnum.NODE_SKIPPED, workspace: '@org/app-b' }, // +10ms
            { type: RunCommandEventEnum.NODE_SKIPPED, workspace: '@org/api' }, // +10ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-a'}, // +40ms
          ],
          [
            { type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/workspace-a'}, // +70ms
          ],
          [
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/workspace-a'}, // +70ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-a' }, // + 70ms
          ],
          [
            { type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/app-a'}, // +100ms
          ],
          [
            { type: RunCommandEventEnum.NODE_INTERRUPTING, workspace: '@org/app-a'}, // +125ms
          ],
          [
            { type: RunCommandEventEnum.NODE_INTERRUPTED, workspace: '@org/app-a'}, // +125ms
          ],
          [
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/app-a'}, // +125ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-a' }, // + 130ms (-> killed)
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-a' }, // + 120ms
          ],
          [
            { type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/app-a'}, // +150ms
            { type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/workspace-b'}, // +150ms
          ],
          [
            { type: RunCommandEventEnum.NODE_INTERRUPTING, workspace: '@org/app-a'}, // +170ms
            { type: RunCommandEventEnum.NODE_INTERRUPTING, workspace: '@org/workspace-b'}, // +175ms
          ],
          [
            { type: RunCommandEventEnum.NODE_INTERRUPTED, workspace: '@org/app-a'}, // +170ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-a' },  // +170ms (-> 320ms)
          ],
          [
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/workspace-b' }, // + 175ms (-> 285ms)
            { type: RunCommandEventEnum.NODE_INTERRUPTED, workspace: '@org/workspace-b'}, // +175ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-b' }, // + 175ms (-> 285ms)
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-c'}, // + 220ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-b' }, // +285ms
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-a' }, // +320ms
          ],
        ], 500);
      } catch (e) {
        expect(e).toBeFalsy();
      }
    });
    it('should restart daemon when flagged as failed - [parallel]', async () => {
      const targets =[
        [
          { workspace: project.workspaces.get('@org/workspace-a')!, hasCommand: false },
          { workspace: project.workspaces.get('@org/workspace-b')!, hasCommand: false },
          { workspace: project.workspaces.get('@org/workspace-c')!, hasCommand: false },
          { workspace: project.workspaces.get('@org/app-a')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-b')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/api')!, hasCommand: true },
        ]
      ]
      stubs.targets?.returns(resolveAfter(targets, 14));

      stubKill(stubs.kill, new Map([
        ['@org/app-a', [{cmd: 'start', delay: 15, pids: [123]} ]],
        ['@org/api', [{cmd: 'start', delay: 5, pids: [123]}, {cmd: 'start', delay: 23, pids: [123]} ]],
      ]))

      stubRunV2(stubs.run, new Map([
        ['@org/app-a', [
          { resolve: true, delay: 42 },
          { resolve: false, delay: 54, error: new Error('Boom!') },
        ]],
        ['@org/app-b', [
          { resolve: true, delay: 50 },
        ]],
        ['@org/api', [
          { resolve: false, error: new Error('Bim!') },
          { resolve: false, error: new Error('Bam!'), delay: 15 },
          { resolve: true, delay: 42 },
        ]],
      ]));

      stubs.watch?.returns(mockSourcesChange(project, targets,[
        { workspaceNames: ['@org/app-a', '@org/api'], delay: 110},
        { workspaceNames: ['@org/workspace-a', '@org/workspace-c', '@org/api'], delay: 210},
      ]));

      const options: RunOptions = {
        cmd: 'start',
        mode: 'parallel',
        watch: true,
        debounce: 50,
      };

      try {
        const runner = new Runner(project, 8);
        const execution$ = runner.runCommand(options);
        await expectObservableV2(Date.now(), execution$, [
          [
            { type: RunCommandEventEnum.TARGETS_RESOLVED },
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-a' },
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-b' },
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/api' },
            { type: RunCommandEventEnum.NODE_SKIPPED, workspace: '@org/workspace-a' },
            { type: RunCommandEventEnum.NODE_SKIPPED, workspace: '@org/workspace-b' },
            { type: RunCommandEventEnum.NODE_SKIPPED, workspace: '@org/workspace-c' },
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-a' },
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-b' },
            { type: RunCommandEventEnum.NODE_ERRORED, workspace: '@org/api' },
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/api' },
          ],
          [
            { type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/app-a' },
            { type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/api' },
          ],
          [
            { type: RunCommandEventEnum.NODE_INTERRUPTING, workspace: '@org/api' },
            { type: RunCommandEventEnum.NODE_INTERRUPTING, workspace: '@org/app-a' },
          ],
          [
            { type: RunCommandEventEnum.NODE_INTERRUPTED, workspace: '@org/api' },
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/api' },
          ],
          [
            { type: RunCommandEventEnum.NODE_INTERRUPTED, workspace: '@org/app-a' },
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/app-a' },
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-a' },
          ],
          [
            { type: RunCommandEventEnum.NODE_ERRORED, workspace: '@org/app-a' },
            { type: RunCommandEventEnum.NODE_ERRORED, workspace: '@org/api' },
          ],
          [
            { type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/workspace-a' },
            { type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/workspace-c' },
            { type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/api' },
            { type: RunCommandEventEnum.NODE_INTERRUPTING, workspace: '@org/api' },
            { type: RunCommandEventEnum.NODE_INTERRUPTED, workspace: '@org/api' },
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/api' },
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/api' },
          ]
        ], 250)
      } catch (e) {
        expect(e).toBeFalsy();
      }
    });
    it('should restart daemon when flagged as succeed - [parallel]', async () => {
      const targets = [
        [
          { workspace: project.workspaces.get('@org/workspace-a')!, hasCommand: false },
          { workspace: project.workspaces.get('@org/workspace-b')!, hasCommand: false },
          { workspace: project.workspaces.get('@org/workspace-c')!, hasCommand: false },
          { workspace: project.workspaces.get('@org/app-a')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-b')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/api')!, hasCommand: true },
        ]
      ]
      stubs.targets?.returns(resolveAfter(targets, 14));

      stubKill(stubs.kill, new Map([
        ['@org/app-a', [{cmd: 'start', delay: 1, pids: [123]} ]],
        ['@org/api', [{cmd: 'start', delay: 12, pids: [123]} ]],
      ]))

      stubRunV2(stubs.run, new Map([
        ['@org/app-a', [
          { resolve: true, delay: 42 },
          { resolve: false, delay: 54, error: new Error('Boom!') },
        ]],
        ['@org/app-b', [
          { resolve: true, delay: 50 },
        ]],
        ['@org/api', [
          { resolve: true, delay: 32 },
          { resolve: true, delay: 120 },
        ]],
      ]));

      stubs.watch?.returns(mockSourcesChange(project, targets, [
        { workspaceNames: ['@org/app-a', '@org/api'], delay: 110},
      ]));

      const options: RunOptions = {
        cmd: 'start',
        mode: 'parallel',
        watch: true,
        debounce: 50,
      };

      try {
        const runner = new Runner(project, 8);
        const execution$ = runner.runCommand(options);
        await expectObservableV2(Date.now(), execution$, [
          [
            { type: RunCommandEventEnum.TARGETS_RESOLVED },
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-a' },
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-b' },
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/api' },
            { type: RunCommandEventEnum.NODE_SKIPPED, workspace: '@org/workspace-a' },
            { type: RunCommandEventEnum.NODE_SKIPPED, workspace: '@org/workspace-b' },
            { type: RunCommandEventEnum.NODE_SKIPPED, workspace: '@org/workspace-c' },
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-a' },
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-b' },
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/api' },
          ],
          [
            { type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/app-a' },
            { type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/api' },
            { type: RunCommandEventEnum.NODE_INTERRUPTING, workspace: '@org/app-a' },
            { type: RunCommandEventEnum.NODE_INTERRUPTING, workspace: '@org/api' },
          ],
          [
            { type: RunCommandEventEnum.NODE_INTERRUPTED, workspace: '@org/app-a' },
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/app-a' },
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/api' },
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-a' },
          ],
          [
            { type: RunCommandEventEnum.NODE_INTERRUPTED, workspace: '@org/api' },
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/api' },
          ],
          [
            { type: RunCommandEventEnum.NODE_ERRORED, workspace: '@org/app-a' },
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/api' },
          ]
        ], 250)
      } catch (e) {
        expect(e).toBeFalsy();
      }
    });
    it('should restart daemon when starting and files change - [parallel]', (done) => {
      const targets = [
        [
          { workspace: project.workspaces.get('@org/workspace-a')!, hasCommand: false },
          { workspace: project.workspaces.get('@org/workspace-b')!, hasCommand: false },
          { workspace: project.workspaces.get('@org/workspace-c')!, hasCommand: false },
          { workspace: project.workspaces.get('@org/app-a')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-b')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/api')!, hasCommand: true },
        ]
      ];
      stubs.targets?.returns(resolveAfter(targets, 12));

      stubKill(stubs.kill, new Map([
        ['@org/app-a', [{cmd: 'start', delay: 150, pids: [123]} ]],
        ['@org/api', [{cmd: 'start', delay: 200, pids: [123]} ]],
      ]))

      stubRunV2(stubs.run, new Map([
        ['@org/app-a', [
          { resolve: true, delay: 200, killed: 100 },
          { resolve: false, delay: 250, error: new Error('Boom!') },
        ]],
        ['@org/app-b', [
          { resolve: true, delay: 220 },
        ]],
        ['@org/api', [
          { resolve: true, delay: 210, killed: 100 },
          { resolve: true, delay: 180 },
        ]],
      ]));

      stubs.watch?.returns(mockSourcesChange(project, targets, [
        { workspaceNames: ['@org/app-a', '@org/api'], delay: 110},
      ]));

      const options: RunOptions = {
        cmd: 'start',
        mode: 'parallel',
        watch: true,
        debounce: 50,
      };

      try {
        const runner = new Runner(project, 8);
        const execution$ = runner.runCommand(options);
        expectObservableV2(Date.now(), execution$, [
          [
            { type: RunCommandEventEnum.TARGETS_RESOLVED }, // +10ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-a' }, // +10ms
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-b' }, // +10ms
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/api' }, // +10ms
            { type: RunCommandEventEnum.NODE_SKIPPED, workspace: '@org/workspace-a' }, // +10ms
            { type: RunCommandEventEnum.NODE_SKIPPED, workspace: '@org/workspace-b' }, // +10ms
            { type: RunCommandEventEnum.NODE_SKIPPED, workspace: '@org/workspace-c' }, // +10ms
          ],
          [
            { type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/app-a' }, // +110ms
            { type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/api' }, // +110ms
            { type: RunCommandEventEnum.NODE_INTERRUPTING, workspace: '@org/app-a' },  // +260ms
            { type: RunCommandEventEnum.NODE_INTERRUPTING, workspace: '@org/api' }, // +310ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-b' }, // +230ms
            { type: RunCommandEventEnum.NODE_INTERRUPTED, workspace: '@org/app-a' },  // +260ms
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/app-a' },
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/api' },
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-a' }, // +320ms
          ],
          [
            { type: RunCommandEventEnum.NODE_INTERRUPTED, workspace: '@org/api' }, // +310ms
          ],
          [

            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/api' }, // +320ms
          ],
          [
            { type: RunCommandEventEnum.NODE_ERRORED, workspace: '@org/app-a' },
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/api' },
          ]
        ], 250).then(() => done());
      } catch (e) {
        expect(e).toBeFalsy();
      }
    });
    it('should do nothing on add node event if already a target - [parallel]', async () => {
      const firstScope = [
        project.workspaces.get('@org/app-a')!,
        project.workspaces.get('@org/app-b')!,
        project.workspaces.get('@org/api')!,
      ]
      const options: RunOptions = {
        cmd: 'start',
        mode: 'parallel',
        watch: true,
        debounce: 50,
        workspaces: firstScope,
      };
      const targets = [
        [
          { workspace: project.workspaces.get('@org/app-a')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-b')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/api')!, hasCommand: true },
        ]
      ]
      stubs.targets?.withArgs('start', options).returns(resolveAfter(targets, 20));

      stubs.watch?.returns(mockSourcesChange(project, targets, []));

      stubRunV2(stubs.run, new Map([
        ['@org/app-a', [
          { resolve: true, delay: 200 },
        ]],
        ['@org/app-b', [
          { resolve: true, delay: 200 },
        ]],
        ['@org/api', [
          { resolve: true, delay: 200 },
        ]],
      ]));
      try {
        const runner = new Runner(project, 8);
        const execution$ = runner.runCommand(options);
        setTimeout(() => {
          runner.addWorkspaces('start', [ project.workspaces.get('@org/api')!]);
        }, 100);
        await expectObservableV2(Date.now(), execution$, [
          [
            { type: RunCommandEventEnum.TARGETS_RESOLVED },
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-a' },
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-b' },
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/api' },
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-a' },
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-b' },
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/api' },
          ],
        ], 250)
      } catch (e) {
        expect(e).toBeFalsy();
      }
    });
    it('should handle correctly add node event when other node are processed - [parallel]', async () => {
      const firstScope = [
        project.workspaces.get('@org/app-a')!,
        project.workspaces.get('@org/app-b')!,
      ]
      const secondScope = [
        project.workspaces.get('@org/app-a')!,
        project.workspaces.get('@org/app-b')!,
        project.workspaces.get('@org/api')!,
      ];
      const options: RunOptions = {
        cmd: 'start',
        mode: 'parallel',
        watch: true,
        debounce: 50,
        workspaces: firstScope,
      };
      stubs.targets?.withArgs('start', options).returns(resolveAfter([
        [
          { workspace: project.workspaces.get('@org/app-a')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-b')!, hasCommand: true },
        ]
      ], 20));
      stubs.targets?.withArgs('start', { ...options, workspaces: secondScope }).returns(resolveAfter([
        [
          { workspace: project.workspaces.get('@org/app-a')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-b')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/api')!, hasCommand: true },
        ]
      ], 20));

      stubs.watch?.returns(mockSourcesChange(project, [], []));

      stubRunV2(stubs.run, new Map([
        ['@org/app-a', [
          { resolve: true, delay: 50 },
        ]],
        ['@org/app-b', [
          { resolve: true, delay: 50 },
        ]],
        ['@org/api', [
          { resolve: true, delay: 50 },
        ]],
      ]));
      try {
        const runner = new Runner(project, 8);
        const execution$ = runner.runCommand(options);
        setTimeout(() => {
          runner.addWorkspaces('start', [ project.workspaces.get('@org/api')!]);
        }, 150);
        await expectObservableV2(Date.now(), execution$, [
          [
            { type: RunCommandEventEnum.TARGETS_RESOLVED },
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-a' },
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-b' },
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-a' },
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-b' },
          ],
          [
            { type: RunCommandEventEnum.TARGETS_RESOLVED },
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/api' },
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/api' },
          ],
        ], 250)
      } catch (e) {
        expect(e).toBeFalsy();
      }
    });
    it('should handle correctly add node event when other node are running - [parallel]', async () => {
      const firstScope = [
        project.workspaces.get('@org/app-a')!,
        project.workspaces.get('@org/app-b')!,
      ]
      const secondScope = [
        project.workspaces.get('@org/app-a')!,
        project.workspaces.get('@org/app-b')!,
        project.workspaces.get('@org/api')!,
      ];
      const options: RunOptions = {
        cmd: 'start',
        mode: 'parallel',
        watch: true,
        debounce: 50,
        workspaces: firstScope,
      };
      stubs.targets?.withArgs('start', options).returns(resolveAfter([
        [
          { workspace: project.workspaces.get('@org/app-a')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-b')!, hasCommand: true },
        ]
      ], 20));
      stubs.targets?.withArgs('start', { ...options, workspaces: secondScope }).returns(resolveAfter([
        [
          { workspace: project.workspaces.get('@org/app-a')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-b')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/api')!, hasCommand: true },
        ]
      ], 20));

      stubs.watch?.returns(mockSourcesChange(project, [], []));

      stubRunV2(stubs.run, new Map([
        ['@org/app-a', [
          { resolve: true, delay: 200 },
        ]],
        ['@org/app-b', [
          { resolve: true, delay: 200 },
        ]],
        ['@org/api', [
          { resolve: true, delay: 200 },
        ]],
      ]));
      try {
        const runner = new Runner(project, 8);
        const execution$ = runner.runCommand(options);
        setTimeout(() => {
          runner.addWorkspaces('start', [ project.workspaces.get('@org/api')!]);
        }, 100);
        await expectObservableV2(Date.now(), execution$, [
          [
            { type: RunCommandEventEnum.TARGETS_RESOLVED },
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-a' },
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-b' },
          ],
          [
            { type: RunCommandEventEnum.TARGETS_RESOLVED },
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/api' },
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-a' },
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-b' },
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/api' },
          ],
        ], 250)
      } catch (e) {
        expect(e).toBeFalsy();
      }
    });
    it('should start watching sources of added node - [parallel]', async () => {
      const firstScope = [
        project.workspaces.get('@org/app-a')!,
        project.workspaces.get('@org/app-b')!,
      ]
      const secondScope = [
        project.workspaces.get('@org/app-a')!,
        project.workspaces.get('@org/app-b')!,
        project.workspaces.get('@org/api')!,
      ];
      const options: RunOptions = {
        cmd: 'start',
        mode: 'parallel',
        watch: true,
        debounce: 50,
        workspaces: firstScope,
      };
      stubs.targets?.withArgs('start', options).returns(resolveAfter([
        [
          { workspace: project.workspaces.get('@org/app-a')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-b')!, hasCommand: true },
        ]
      ], 20));
      const secondScopeTargets = [
        [
          { workspace: project.workspaces.get('@org/app-a')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-b')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/api')!, hasCommand: true },
        ]
      ]
      stubs.targets?.withArgs('start', { ...options, workspaces: secondScope }).returns(resolveAfter(secondScopeTargets, 20));

      stubs.watch?.returns(mockSourcesChange(project, secondScopeTargets, [
        { workspaceNames: ['@org/app-b', '@org/api'], delay: 350},
      ]));

      stubKill(stubs.kill, new Map([
        ['@org/app-b', [{cmd: 'start', delay: 12, pids: [123] } ]],
        ['@org/api', [{cmd: 'start', delay: 24, pids: [123] } ]],
      ]))

      stubRunV2(stubs.run, new Map([
        ['@org/app-a', [
          { resolve: true, delay: 200 },
        ]],
        ['@org/app-b', [
          { resolve: true, delay: 200 },
          { resolve: true, delay: 40 },
        ]],
        ['@org/api', [
          { resolve: true, delay: 200 },
          { resolve: true, delay: 30 },
        ]],
      ]));
      try {
        const runner = new Runner(project, 8);
        const execution$ = runner.runCommand(options);
        setTimeout(() => {
          runner.addWorkspaces('start', [ project.workspaces.get('@org/api')!]);
        }, 100);
        await expectObservableV2(Date.now(), execution$, [
          [
            { type: RunCommandEventEnum.TARGETS_RESOLVED },
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-a' },
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-b' },
          ],
          [
            { type: RunCommandEventEnum.TARGETS_RESOLVED },
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/api' },
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-a' },
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-b' },
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/api' },
          ],
          [
            { type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/api' },
            { type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/app-b' },
          ],
          [
            { type: RunCommandEventEnum.NODE_INTERRUPTING, workspace: '@org/app-b' },
            { type: RunCommandEventEnum.NODE_INTERRUPTING, workspace: '@org/api' },
          ],
          [
            { type: RunCommandEventEnum.NODE_INTERRUPTED, workspace: '@org/app-b' },
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/api' },
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/app-b' },
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-b' },
          ],
          [
            { type: RunCommandEventEnum.NODE_INTERRUPTED, workspace: '@org/api' },
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/api' },

          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-b' },
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/api' },
          ],
        ], 250)
      } catch (e) {
        expect(e).toBeFalsy();
      }
    });
    it('should do nothing on remove node event if not a target - [parallel]', async () => {
      const firstScope = [
        project.workspaces.get('@org/app-a')!,
        project.workspaces.get('@org/app-b')!,
      ];
      const options: RunOptions = {
        cmd: 'start',
        mode: 'parallel',
        watch: true,
        debounce: 50,
        workspaces: firstScope,
      };

      stubs.targets?.withArgs('start', options).returns(resolveAfter([
        [
          { workspace: project.workspaces.get('@org/app-a')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-b')!, hasCommand: true },
        ]
      ], 20));

      stubs.watch?.returns(mockSourcesChange(project, [], []));

      stubRunV2(stubs.run, new Map([
        ['@org/app-a', [
          { resolve: true, delay: 200 },
        ]],
        ['@org/app-b', [
          { resolve: true, delay: 200 },
        ]],
        ['@org/api', [
          { resolve: true, delay: 200 },
        ]],
      ]));
      try {
        const runner = new Runner(project, 8);
        const execution$ = runner.runCommand(options);
        setTimeout(() => {
          runner.removeWorkspace('start', [ project.workspaces.get('@org/api')!]);
        }, 100);
        await expectObservableV2(Date.now(), execution$, [
          [
            { type: RunCommandEventEnum.TARGETS_RESOLVED },
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-a' },
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-b' },
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-a' },
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-b' },
          ],
        ], 250)
      } catch (e) {
        expect(e).toBeFalsy();
      }
    });
    it('should handle correctly remove node event for daemon - [parallel]', async () => {
      const firstScope = [
        project.workspaces.get('@org/app-a')!,
        project.workspaces.get('@org/app-b')!,
        project.workspaces.get('@org/api')!,
      ];
      const secondScope = [
        project.workspaces.get('@org/app-a')!,
        project.workspaces.get('@org/app-b')!,
      ]
      const thirdScope = [
        project.workspaces.get('@org/app-a')!,
      ]
      const options: RunOptions = {
        cmd: 'start',
        mode: 'parallel',
        watch: true,
        debounce: 50,
        workspaces: firstScope,
      };

      stubs.targets?.withArgs('start', options).returns(resolveAfter([
        [
          { workspace: project.workspaces.get('@org/app-a')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-b')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/api')!, hasCommand: true },
        ]
      ], 20));

      stubs.targets?.withArgs('start', {...options, workspaces: secondScope}).returns(resolveAfter([
        [
          { workspace: project.workspaces.get('@org/app-a')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-b')!, hasCommand: true },
        ]
      ], 20));

      stubs.targets?.withArgs('start', {...options, workspaces: thirdScope}).returns(resolveAfter([
        [
          { workspace: project.workspaces.get('@org/app-a')!, hasCommand: true },
        ]
      ], 20));

      stubs.watch?.returns(mockSourcesChange(project, [], []));

      stubRunV2(stubs.run, new Map([
        ['@org/app-a', [
          { resolve: true, delay: 200 },
        ]],
        ['@org/app-b', [
          { resolve: true, delay: 200 },
        ]],
        ['@org/api', [
          { resolve: true, delay: 200, killed: 140 },
        ]],
      ]));

      stubKill(stubs.kill, new Map([
        ['@org/app-b', [
          { cmd: 'start', delay: 20, pids: [34] },
        ]],
        ['@org/api', [
          { cmd: 'start', delay: 20, pids: [34343] },
        ]],
      ]));

      try {
        const runner = new Runner(project, 8);
        const execution$ = runner.runCommand(options);
        setTimeout(() => {
          runner.removeWorkspace('start', [ project.workspaces.get('@org/api')!]);
          console.debug('100ms');
        }, 100);
        setTimeout(() => {
          console.debug('300ms');
          runner.removeWorkspace('start', [ project.workspaces.get('@org/app-b')!]);
        }, 300);
        await expectObservableV2(Date.now(), execution$, [
          [
            { type: RunCommandEventEnum.TARGETS_RESOLVED }, // +20ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-a' },  // +20ms
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-b' },  // +20ms
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/api' },  // +20ms
          ],
          [
            { type: RunCommandEventEnum.TARGETS_RESOLVED },  // +140ms
          ],
          [
            { type: RunCommandEventEnum.NODE_INTERRUPTING, workspace: '@org/api' }, // +160ms
          ],
          [
            { type: RunCommandEventEnum.NODE_INTERRUPTED, workspace: '@org/api' }, // +160ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-a' }, // +220ms
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-b' }, // +220ms
          ],
          [
            { type: RunCommandEventEnum.TARGETS_RESOLVED }, // +320ms
          ],
          [
            { type: RunCommandEventEnum.NODE_INTERRUPTING, workspace: '@org/app-b' }, // +340ms
          ],
          [
            { type: RunCommandEventEnum.NODE_INTERRUPTED, workspace: '@org/app-b' }, // +340ms
          ],
        ], 250)
      } catch (e) {
        expect(e).toBeFalsy();
      }
    });
    it('should handle correctly remove node event for normal process - [parallel]', async () => {
      const firstScope = [
        project.workspaces.get('@org/app-a')!,
        project.workspaces.get('@org/app-b')!,
        project.workspaces.get('@org/api')!,
      ];
      const secondScope = [
        project.workspaces.get('@org/app-a')!,
        project.workspaces.get('@org/app-b')!,
      ]
      const thirdScope = [
        project.workspaces.get('@org/app-a')!,
      ]
      const options: RunOptions = {
        cmd: 'lint',
        mode: 'parallel',
        watch: true,
        debounce: 50,
        workspaces: firstScope,
      };

      stubs.targets?.withArgs('lint', options).returns(resolveAfter([
        [
          { workspace: project.workspaces.get('@org/app-a')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-b')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/api')!, hasCommand: true },
        ]
      ], 20));

      stubs.targets?.withArgs('lint', {...options, workspaces: secondScope}).returns(resolveAfter([
        [
          { workspace: project.workspaces.get('@org/app-a')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-b')!, hasCommand: true },
        ]
      ], 20));

      stubs.targets?.withArgs('lint', {...options, workspaces: thirdScope}).returns(resolveAfter([
        [
          { workspace: project.workspaces.get('@org/app-a')!, hasCommand: true },
        ]
      ], 20));

      stubs.watch?.returns(mockSourcesChange(project, [], []));

      stubRunV2(stubs.run, new Map([
        ['@org/app-a', [
          { resolve: true, delay: 200 },
        ]],
        ['@org/app-b', [
          { resolve: true, delay: 200 },
        ]],
        ['@org/api', [
          { resolve: true, delay: 200, killed: 140 },
        ]],
      ]));

      stubKill(stubs.kill, new Map([
        ['@org/api', [
          { cmd: 'lint', delay: 20, pids: [223] },
        ]],
      ]));

      try {
        const runner = new Runner(project, 8);
        const execution$ = runner.runCommand(options);
        setTimeout(() => {
          runner.removeWorkspace('lint', [ project.workspaces.get('@org/api')!]);
          console.debug('100ms');
        }, 100);
        setTimeout(() => {
          console.debug('300ms');
          runner.removeWorkspace('lint', [ project.workspaces.get('@org/app-b')!]);
        }, 300);
        await expectObservableV2(Date.now(), execution$, [
          [
            { type: RunCommandEventEnum.TARGETS_RESOLVED }, // +20ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-a' },  // +20ms
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-b' },  // +20ms
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/api' },  // +20ms
          ],
          [
            { type: RunCommandEventEnum.TARGETS_RESOLVED },  // +140ms
          ],
          [
            { type: RunCommandEventEnum.NODE_INTERRUPTING, workspace: '@org/api' }, // +160ms
          ],
          [
            { type: RunCommandEventEnum.NODE_INTERRUPTED, workspace: '@org/api' }, // +160ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-a' }, // +220ms
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-b' }, // +220ms
          ],
          [
            { type: RunCommandEventEnum.TARGETS_RESOLVED }, // +320ms
          ]
        ], 250)
      } catch (e) {
        expect(e).toBeFalsy();
      }
    });
    it('should stop watching sources of removed node - [parallel]', async () => {
      const firstScope = [
        project.workspaces.get('@org/app-a')!,
        project.workspaces.get('@org/app-b')!,
        project.workspaces.get('@org/api')!,
      ];
      const secondScope = [
        project.workspaces.get('@org/app-a')!,
        project.workspaces.get('@org/app-b')!,
      ]
      const thirdScope = [
        project.workspaces.get('@org/app-a')!,
      ]
      const options: RunOptions = {
        cmd: 'start',
        mode: 'parallel',
        watch: true,
        debounce: 50,
        workspaces: firstScope,
      };

      const targets = [
        [
          { workspace: project.workspaces.get('@org/app-a')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-b')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/api')!, hasCommand: true },
        ]
      ]

      stubs.targets?.withArgs('start', options).returns(resolveAfter(targets, 20));

      stubs.targets?.withArgs('start', {...options, workspaces: secondScope}).returns(resolveAfter([
        [
          { workspace: project.workspaces.get('@org/app-a')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-b')!, hasCommand: true },
        ]
      ], 20));

      stubs.targets?.withArgs('start', {...options, workspaces: thirdScope}).returns(resolveAfter([
        [
          { workspace: project.workspaces.get('@org/app-a')!, hasCommand: true },
        ]
      ], 20));

      // should not happen as we have unwatched these workspaces, but we have a security
      stubs.watch?.returns(mockSourcesChange(project, targets, [
        { workspaceNames: ['@org/api'], delay: 110 },
        { workspaceNames: ['@org/api', '@org/app-b'], delay: 320 },
      ]));

      stubRunV2(stubs.run, new Map([
        ['@org/app-a', [
          { resolve: true, delay: 200 },
        ]],
        ['@org/app-b', [
          { resolve: true, delay: 200 },
        ]],
        ['@org/api', [
          { resolve: true, delay: 200, killed: 140 },
        ]],
      ]));

      stubKill(stubs.kill, new Map([
        ['@org/app-b', [
          { cmd: 'start', delay: 20, pids: [23] },
        ]],
        ['@org/api', [
          { cmd: 'start', delay: 20, pids: [42] },
        ]],
      ]));

      try {
        const runner = new Runner(project, 8);
        const execution$ = runner.runCommand(options);
        setTimeout(() => {
          runner.removeWorkspace('start', [ project.workspaces.get('@org/api')!]);
          console.debug('100ms');
        }, 100);
        setTimeout(() => {
          console.debug('300ms');
          runner.removeWorkspace('start', [ project.workspaces.get('@org/app-b')!]);
        }, 300);
        await expectObservableV2(Date.now(), execution$, [
          [
            { type: RunCommandEventEnum.TARGETS_RESOLVED }, // +20ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-a' },  // +20ms
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-b' },  // +20ms
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/api' },  // +20ms
          ],
          [
            { type: RunCommandEventEnum.TARGETS_RESOLVED },  // +140ms
          ],
          [
            { type: RunCommandEventEnum.NODE_INTERRUPTING, workspace: '@org/api' }, // +160ms
          ],
          [
            { type: RunCommandEventEnum.NODE_INTERRUPTED, workspace: '@org/api' }, // +160ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-a' }, // +220ms
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-b' }, // +220ms
          ],
          [
            { type: RunCommandEventEnum.TARGETS_RESOLVED }, // +320ms
          ],
          [
            { type: RunCommandEventEnum.NODE_INTERRUPTING, workspace: '@org/app-b' }, // +340ms
          ],
          [
            { type: RunCommandEventEnum.NODE_INTERRUPTED, workspace: '@org/app-b' }, // +340ms
          ],
        ], 250);
        const calls = stubs.watch?.getCalls();
        expect(calls?.length).toBe(3);
        expect((calls?.at(0)?.thisValue as Watcher).targets.flat().map((t) => t.workspace.name)).toEqual(['@org/app-a', '@org/app-b', '@org/api']);
        expect((calls?.at(1)?.thisValue as Watcher).targets.flat().map((t) => t.workspace.name)).toEqual(['@org/app-a', '@org/app-b']);
        expect((calls?.at(2)?.thisValue as Watcher).targets.flat().map((t) => t.workspace.name)).toEqual(['@org/app-a']);
      } catch (e) {
        expect(e).toBeFalsy();
      }
    });
    it('should handle complex scenarios were adding/removing nodes - [parallel]', async () => {

      const scopes = [
        [
          project.workspaces.get('@org/app-a')!,
          project.workspaces.get('@org/app-b')!,
          project.workspaces.get('@org/api')!,
        ], // + 0ms
        [
          project.workspaces.get('@org/app-a')!,
          project.workspaces.get('@org/app-b')!,
        ], // +100ms
        [
          project.workspaces.get('@org/app-a')!,
          project.workspaces.get('@org/app-b')!,
          project.workspaces.get('@org/api')!,
        ], // + 300ms
        [
          project.workspaces.get('@org/app-a')!
        ], // +550ms
        [
          project.workspaces.get('@org/app-a')!,
          project.workspaces.get('@org/app-b')!,
          project.workspaces.get('@org/api')!,
        ], // +700ms
      ];
      const options: RunOptions = {
        cmd: 'start',
        mode: 'parallel',
        watch: true,
        debounce: 50,
        workspaces: scopes[0],
      };
      scopes.forEach((scope) => {
        stubs.targets?.withArgs('start', { ...options, workspaces: scope }).returns(resolveAfter([
          scope.map((workspace) => ({ workspace, hasCommand: true })),
        ], 20));
      });

      stubs.watch?.onCall(0)?.returns(mockSourcesChange(project, [], [])); // +0ms
      stubs.watch?.onCall(1)?.returns(mockSourcesChange(project, [], [])); // +0ms
      stubs.watch?.onCall(2)?.returns(mockSourcesChange(
        project,
        [scopes[2].map((workspace) => ({ workspace, hasCommand: true }))],
        [ // +320ms
        { workspaceNames: ['@org/app-a', '@org/app-b'], delay: 350 - 320 },
      ]));
      stubs.watch?.onCall(3)?.returns(mockSourcesChange(
        project,
        [scopes[3].map((workspace) => ({ workspace, hasCommand: true }))],
        [ // +570ms
        { workspaceNames: ['@org/app-a', '@org/app-b'], delay: 600 - 570 }
      ]));
      stubs.watch?.onCall(4)?.returns(mockSourcesChange(project, [], [])); // +0ms

      stubRunV2(stubs.run, new Map([
        ['@org/app-a', [
          { resolve: true, delay: 200 }, // + 20ms
          { resolve: true, delay: 120 }, // + 380ms
          { resolve: true, delay: 160 }, // + 640ms

        ]],
        ['@org/app-b', [
          { resolve: true, delay: 200 }, // + 20ms
          { resolve: true, delay: 220, killed: 190 }, // + 380ms
          { resolve: true, delay: 60 }, // + 740ms
        ]],
        ['@org/api', [
          { resolve: true, delay: 200, killed: 100 }, // + 20ms
          { resolve: false, delay: 180, error: new Error('boom') }, // + 320ms
          { resolve: true, delay: 60 }, // + 740ms
        ]],
      ]));

      stubKill(stubs.kill, new Map([
        ['@org/app-a', [
          { cmd: 'start', delay: 12, pids: [23] },  // +350ms
          { cmd: 'start', delay: 12, pids: [23] },  // +600ms
        ]],
        ['@org/app-b', [
          { cmd: 'start', delay: 20, pids: [23] },  // +350ms
          { cmd: 'start', delay: 20, pids: [23] },  // +550ms
        ]],
        ['@org/api', [
          { cmd: 'start', delay: 20, pids: [23] },  // +100ms
          { cmd: 'start', delay: 20, pids: [23] },  // +550ms
        ]],
      ]));

      try {
        const runner = new Runner(project, 8);
        const execution$ = runner.runCommand(options);
        setTimeout(() => {
          runner.removeWorkspace('start', [ project.workspaces.get('@org/api')!]);
        }, 100);
        setTimeout(() => {
          runner.addWorkspaces('start', [ project.workspaces.get('@org/api')!]);
        }, 300);
        setTimeout(() => {
          runner.removeWorkspace('start', [ project.workspaces.get('@org/app-b')!, project.workspaces.get('@org/api')!]);
        }, 550);
        setTimeout(() => {
          runner.addWorkspaces('start', [ project.workspaces.get('@org/app-b')!, project.workspaces.get('@org/api')!]);
        }, 700);
        await expectObservableV2(Date.now(), execution$, [
          [
            { type: RunCommandEventEnum.TARGETS_RESOLVED }, // +20ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-a' }, // +30ms
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-b' }, // +30ms
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/api' }, // +30ms
          ],
          [
            { type: RunCommandEventEnum.TARGETS_RESOLVED }, // +100ms
          ],
          [
            { type: RunCommandEventEnum.NODE_INTERRUPTING, workspace: '@org/api' }, // +130ms
          ],
          [
            { type: RunCommandEventEnum.NODE_INTERRUPTED, workspace: '@org/api' }, // +130ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-a' }, // +260ms
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-b' }, // +260ms
          ],
          [
            { type: RunCommandEventEnum.TARGETS_RESOLVED }, // +320ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/api' }, // +304ms
          ],
          [
            { type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/app-a' }, // +350ms
            { type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/app-b' }, // +350ms
          ],
          [
            { type: RunCommandEventEnum.NODE_INTERRUPTING, workspace: '@org/app-a' }, // +370ms
            { type: RunCommandEventEnum.NODE_INTERRUPTING, workspace: '@org/app-b' }, // +370ms
          ],
          [
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/app-a' }, // +350ms
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/app-b' }, // +350ms
            { type: RunCommandEventEnum.NODE_INTERRUPTED, workspace: '@org/app-a' }, // +370ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-a' }, // +380ms
          ],
          [
            { type: RunCommandEventEnum.NODE_INTERRUPTED, workspace: '@org/app-b' }, // +370ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-b' }, // +380ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-a' }, // +500ms
            { type: RunCommandEventEnum.NODE_ERRORED, workspace: '@org/api' }, // +500ms
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/api' }, // +500ms
          ],
          [
            { type: RunCommandEventEnum.TARGETS_RESOLVED }, // +550ms
          ],
          [
            { type: RunCommandEventEnum.NODE_INTERRUPTING, workspace: '@org/api' }, // +570ms
            { type: RunCommandEventEnum.NODE_INTERRUPTING, workspace: '@org/app-b' }, // +570ms
          ],
          [
            { type: RunCommandEventEnum.NODE_INTERRUPTED, workspace: '@org/api' }, // +570ms
            { type: RunCommandEventEnum.NODE_INTERRUPTED, workspace: '@org/app-b' }, // +570ms
          ],
          [
            { type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/app-a' }, // +600ms
          ],
          [
            { type: RunCommandEventEnum.NODE_INTERRUPTING, workspace: '@org/app-a' }, // +620ms
          ],
          [
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/app-a' }, // +500ms
            { type: RunCommandEventEnum.NODE_INTERRUPTED, workspace: '@org/app-a' }, // +620ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-a' }, // +640ms
          ],
          [
            { type: RunCommandEventEnum.TARGETS_RESOLVED }, // +720ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-b' }, // +740ms
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/api' }, // +740ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-a' }, // +800ms
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-b' }, // +800ms
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/api' }, // +800ms
          ],
        ], 250)
      } catch (e) {
        expect(e).toBeFalsy();
      }
    });
    it('should handle filesystem events while re-computing targets - [parallel]', async () => {

      const scopes = [
        [
          project.workspaces.get('@org/app-a')!,
          project.workspaces.get('@org/app-b')!,
        ], // + 0ms (initial scope), resolved @ 5ms
        [
          project.workspaces.get('@org/app-a')!,
          project.workspaces.get('@org/app-b')!,
          project.workspaces.get('@org/api')!,
        ], // triggered @ +100ms (-> resolved @ +250ms)
      ];
      const resolveTargetsTimings = [5, 250];
      const options: RunOptions = {
        cmd: 'start',
        mode: 'parallel',
        watch: true,
        debounce: 50,
        workspaces: scopes[0],
      };
      scopes.forEach((scope, idx) => {
        stubs.targets?.withArgs('start', { ...options, workspaces: scope }).returns(resolveAfter([
          scope.map((workspace) => ({ workspace, hasCommand: true })),
        ], resolveTargetsTimings[idx]));
      });

      stubs.watch?.onCall(0)?.returns(mockSourcesChange( // +0ms
        project,
        [scopes[1].map((workspace) => ({ workspace, hasCommand: true }))],
        [
          { workspaceNames: ['@org/app-a', '@org/app-b'], delay: 200 },
        ]));
      stubs.watch?.onCall(1)?.returns(mockSourcesChange( // +250ms
        project,
        [scopes[1].map((workspace) => ({ workspace, hasCommand: true }))],
        [ // +320ms
          { workspaceNames: ['@org/app-a', '@org/api'], delay: 20 },
        ]));

      stubRunV2(stubs.run, new Map([
        ['@org/app-a', [
          { resolve: true, delay: 210, killed: 195 }, // + 5ms
          { resolve: true, delay: 120, killed: 70 }, // + 200ms
          { resolve: true, delay: 100 }, // + 200ms
        ]],
        ['@org/app-b', [
          { resolve: true, delay: 170 }, // + 5ms
          { resolve: true, delay: 100 }, // + 280ms
        ]],
        ['@org/api', [
          { resolve: true, delay: 200, killed: 20 }, // + 250ms
          { resolve: false, delay: 100, error: new Error('boom') }, // + 280ms
        ]],
      ]));

      stubKill(stubs.kill, new Map([
        ['@org/app-a', [
          { cmd: 'start', delay: 20, pids: [23] },  // +350ms
          { cmd: 'start', delay: 50, pids: [23] },  // +350ms
        ]],
        ['@org/app-b', [
          { cmd: 'start', delay: 100, pids: [23] },  // +350ms
        ]],
        ['@org/api', [
          { cmd: 'start', delay: 10, pids: [23] },  // +100ms
        ]],
      ]));

      try {
        const runner = new Runner(project, 8);
        const execution$ = runner.runCommand(options);
        setTimeout(() => {
          runner.addWorkspaces('start', [ project.workspaces.get('@org/api')!]);
        }, 100);
        await expectObservableV2(Date.now(), execution$, [
          [
            { type: RunCommandEventEnum.TARGETS_RESOLVED }, // +5ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-a' }, // +5ms (-> 215ms but killed @ 200ms)
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-b' }, // +5ms (-> 175ms)
          ],
          // scope changes (+100ms)
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-b' }, // 175ms
          ],
          [
            { type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/app-a' }, // 200ms
            { type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/app-b' }, // 200ms
            { type: RunCommandEventEnum.NODE_INTERRUPTING, workspace: '@org/app-a' }, // 200ms
            { type: RunCommandEventEnum.NODE_INTERRUPTING, workspace: '@org/app-b' }, // 200ms
          ],
          [
            { type: RunCommandEventEnum.NODE_INTERRUPTED, workspace: '@org/app-a' }, // 220ms
          ],
          [
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/app-a' }, // 200ms
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/app-b' }, // 200ms
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-a' }, // 220ms (-> 340ms / killed @ 270ms)
          ],
          [
            { type: RunCommandEventEnum.TARGETS_RESOLVED }, // +250ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/api' }, // +250ms (-> killed @ 270ms)
          ],
          [
            { type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/api' }, // +270ms
            { type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/app-a' }, // +270ms
            { type: RunCommandEventEnum.NODE_INTERRUPTING, workspace: '@org/api' }, // +270ms
            { type: RunCommandEventEnum.NODE_INTERRUPTING, workspace: '@org/app-a' }, // +270ms
          ],
          [
            { type: RunCommandEventEnum.NODE_INTERRUPTED, workspace: '@org/api' }, // +280ms
          ],
          [
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/api' }, // +280ms
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/api' }, // +280ms (-> 380ms)
          ],
          [
            { type: RunCommandEventEnum.NODE_INTERRUPTED, workspace: '@org/app-b' }, // +300ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-b' }, // +300 (-> +400ms)
          ],
          [
            { type: RunCommandEventEnum.NODE_INTERRUPTED, workspace: '@org/app-a' }, // +320ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-a' }, // +320ms (-> +420ms)
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-a' }, // +420ms
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-b' }, // +400ms
            { type: RunCommandEventEnum.NODE_ERRORED, workspace: '@org/api' }, // +380ms
          ],
        ], 250)
      } catch (e) {
        expect(e).toBeFalsy();
      }
    });
    it('should handle correctly interruption in previous step - [topological]', async () => {
      const targets = [
        [
          { workspace: project.workspaces.get('@org/workspace-a')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/workspace-b')!, hasCommand: true },
        ],
        [
          { workspace: project.workspaces.get('@org/workspace-c')!, hasCommand: true },
        ],
        [
          { workspace: project.workspaces.get('@org/app-a')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-b')!, hasCommand: true },
        ],
        [
          { workspace: project.workspaces.get('@org/api')!, hasCommand: true },
        ]
      ]
      stubs.targets?.returns(resolveAfter(targets, 12));
      stubs.watch?.returns(mockSourcesChange(project, targets, [
        { workspaceNames: ['@org/workspace-a'], delay: 320},
        { workspaceNames: ['@org/workspace-a'], delay: 840},
        { workspaceNames: ['@org/app-a'], delay: 1400},
      ]));
      stubKill(stubs.kill, new Map([
        ['@org/workspace-a', [{cmd: 'build', delay: 23}, {cmd: 'build', delay: 12}]],
        ['@org/workspace-c', [{cmd: 'build', delay: 15, pids: [23]}]],
        ['@org/app-a', [{cmd: 'build', delay: 31, pids: [23]}]],
        ['@org/app-b', [{cmd: 'build', delay: 19, pids: [23]}]],
      ]));
      const options: RunOptions = {
        cmd: 'build',
        mode: 'topological',
        force: false,
        args: [],
        env: {},
        watch: true,
        debounce: 8,
      };
      stubRunV2(stubs.run, new Map([
        ['@org/workspace-a', [
          { resolve: true, delay: 200 },
          { resolve: true, delay: 200 },
          { resolve: true, delay: 200 },
        ]],
        ['@org/workspace-b', [
          { resolve: true, delay: 200 },
        ]],
        ['@org/workspace-c', [
          { resolve: true, delay: 300, killed: 120 },
          { resolve: true, delay: 200 },
          { resolve: true, delay: 20 },
        ]],
        ['@org/app-a', [
          { resolve: true, delay: 150, killed: 100 },
          { resolve: true, delay: 200 },
          { resolve: true, delay: 20 },
          { resolve: true, delay: 20 },
        ]],
        ['@org/app-b', [
          { resolve: true, delay: 120, killed: 100 },
          { resolve: true, delay: 200 },
          { resolve: true, delay: 20 },
        ]],
        ['@org/api', [
          { resolve: true, delay: 2 },
          { resolve: true, delay: 2 },
          { resolve: true, delay: 20 },
          { resolve: true, delay: 20 },
        ]],
      ]));
      try {
        const runner = new Runner(project, 4);
        const execution$ = runner.runCommand(options);
        await expectObservableV2(Date.now(), execution$, [
          [
            { type: RunCommandEventEnum.TARGETS_RESOLVED }, // +12ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-a' }, // +41ms
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-b' }, // +48ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-a' }, // +250ms
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/workspace-c' }, // +260ms
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/app-b' }, // +260ms
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/app-a' }, // +260ms
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/api' }, // +260ms
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-b' },  // +270ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-c' },  // +280ms
          ],
          [
            { type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/workspace-a' },  // +370ms
            { type: RunCommandEventEnum.NODE_INTERRUPTING, workspace: '@org/workspace-c' }, // + 390ms
            { type: RunCommandEventEnum.NODE_INTERRUPTED, workspace: '@org/workspace-c' }, // + 390ms
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/workspace-a' }, // +390ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-a' }, // 405ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-a' }, // +600ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-c' }, //+ 605ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-c' }, // +808ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-a' }, // +810ms
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-b' }, // +810ms
          ],
          [
            { type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/workspace-a' }, // +893ms
            { type: RunCommandEventEnum.NODE_INTERRUPTING, workspace: '@org/app-a' }, // +920ms
            { type: RunCommandEventEnum.NODE_INTERRUPTING, workspace: '@org/app-b' }, // +930ms
            { type: RunCommandEventEnum.NODE_INTERRUPTED, workspace: '@org/app-a' }, // +920ms
            { type: RunCommandEventEnum.NODE_INTERRUPTED, workspace: '@org/app-b' }, // +930ms
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/workspace-a' }, // +945ms
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/workspace-c' }, // +945ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-a' }, // +950ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-a' }, // +1140ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-c' }, // +1150ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-c' }, // +1170ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-a' },  // +1180ms
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-b' },  // +1180ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-a' },  // +1260ms
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-b' },  // +1180ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/api' }, //+1380
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/api' }, // +1388
          ],
          [
            { type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/app-a' }, // + 1454
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/app-a' }, // +1461
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/api' }, // +
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-a' },
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-a' },
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/api' },
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/api' },
          ],
        ], 500)
      } catch (e) {
        expect(e).toBeFalsy();
      }
    });
    it('should handle correctly interruption in subsequent step - [topological]', async () => {
      const targets = [
        [
          { workspace: project.workspaces.get('@org/workspace-a')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/workspace-b')!, hasCommand: true },
        ],
        [
          { workspace: project.workspaces.get('@org/workspace-c')!, hasCommand: true },
        ],
        [
          { workspace: project.workspaces.get('@org/app-a')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-b')!, hasCommand: true },
        ],
        [
          { workspace: project.workspaces.get('@org/api')!, hasCommand: true },
        ]
      ]
      stubs.targets?.returns(resolveAfter(targets, 12));
      stubs.watch?.returns(mockSourcesChange(project, targets, [
        { workspaceNames: ['@org/workspace-c'], delay: 60},
        { workspaceNames: ['@org/app-a'], delay: 400},
        { workspaceNames: ['@org/api'], delay: 650},
      ]));
      const options: RunOptions = {
        cmd: 'build',
        mode: 'topological',
        force: false,
        args: [],
        env: {},
        watch: true,
        debounce: 8,
      };
      stubRun(stubs.run, [
        // Schedule 1
        { resolve: true, options, delay: 200 }, // (w-a)
        { resolve: true, options, delay: 200 }, // (w-b)
        { resolve: true, options, delay: 300 }, // (w-c) // +200ms
        { resolve: true, options, delay: 150 }, // (app-a)
        { resolve: true, options, delay: 200 }, // app-b)
        { resolve: true, options, delay: 100 }, // (api)
        // Schedule 2
      ]);
      try {
        const runner = new Runner(project, 4);
        const execution$ = runner.runCommand(options);
        await expectObservableV2(Date.now(), execution$, [
          [
            { type: RunCommandEventEnum.TARGETS_RESOLVED },
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-a' },
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-b' },
          ],
          [
            { type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/workspace-c' },
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-a' },
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-b' },
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/workspace-c' },
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/app-a' },
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/app-b' },
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/api' },
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-c' },
          ],
          [
            { type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/app-a' },
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-c' },
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-a' },
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-b' },
          ],
          [
            { type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/api' },
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-a' },
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-b' },
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/api' },
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/api' },
          ],
        ], 200);
      } catch (e) {
        expect(e).toBeFalsy();
      }
    });
    it('should handle correctly interruption in current step (running node) - [topological]', async () => {
      const targets = [
        [
          { workspace: project.workspaces.get('@org/workspace-a')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/workspace-b')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/workspace-c')!, hasCommand: true },
        ],
        [
          { workspace: project.workspaces.get('@org/app-a')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-b')!, hasCommand: true },
        ],
        [
          { workspace: project.workspaces.get('@org/api')!, hasCommand: true },
        ]
      ]
      stubs.targets?.returns(resolveAfter(targets, 12));
      stubs.watch?.returns(mockSourcesChange(project, targets,[
        { workspaceNames: ['@org/workspace-b'], delay: 100},
      ]));

      stubKill(stubs.kill, new Map([
        ['@org/workspace-b', [{ cmd: 'build', delay: 10, pids: [133] }]],
      ]));
      const options: RunOptions = {
        cmd: 'build',
        mode: 'topological',
        force: false,
        args: [],
        env: {},
        watch: true,
        debounce: 8,
      };
      stubRunV2(stubs.run, new Map([
        ['@org/workspace-a', [
          { resolve: true, options, delay: 200 },
        ]],
        ['@org/workspace-b', [
          { resolve: true, options, delay: 200, killed: 150 },
          { resolve: true, options, delay: 200 },
        ]],
        ['@org/workspace-c', [
          { resolve: true, options, delay: 300 },
        ]],
        ['@org/app-a', [
          { resolve: true, options, delay: 0 }, // not-subscribed
          { resolve: true, options, delay: 20 },
        ]],
        ['@org/app-b', [
          { resolve: true, options, delay: 0 }, // not-subscribed
          { resolve: true, options, delay: 20 },
        ]],
        ['@org/api', [
          { resolve: true, options, delay: 0 }, // not-subscribed
          { resolve: true, options, delay: 20 },
        ]],
      ]));
      try {
        const runner = new Runner(project, 2);
        const execution$ = runner.runCommand(options);
        await expectObservableV2(Date.now(), execution$, [
          [
            { type: RunCommandEventEnum.TARGETS_RESOLVED }, // +5ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-a' }, // +5ms
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-b' }, // +5ms
          ],
          [
            { type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/workspace-b' }, // +150ms
            { type: RunCommandEventEnum.NODE_INTERRUPTING, workspace: '@org/workspace-b' }, // +160ms
          ],
          [
            { type: RunCommandEventEnum.NODE_INTERRUPTED, workspace: '@org/workspace-b' }, // +160ms
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/workspace-b' }, // + 160ms
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/app-b' }, // + 160ms
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/app-a' }, // + 160ms
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/api' }, // + 160ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-b' }, // + 160ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-a' }, // + 200ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-c' }, // + 200ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-b' }, // + 360ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-c' }, // + 500ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-a' }, // +505ms
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-b' }, // +505ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-a' }, // +510ms
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-b' }, // +510ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/api' }, // +510ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/api' }, // +510ms
          ],
        ], 500);
      } catch (e) {
        expect(e).toBeFalsy();
      }
    });
    it('should handle correctly interruption in current step (processed node) - [topological]', async () => {
      const targets = [
        [
          { workspace: project.workspaces.get('@org/workspace-a')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/workspace-b')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/workspace-c')!, hasCommand: true },
        ],
        [
          { workspace: project.workspaces.get('@org/app-a')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-b')!, hasCommand: true },
        ],
        [
          { workspace: project.workspaces.get('@org/api')!, hasCommand: true },
        ]
      ]
      stubs.targets?.returns(resolveAfter(targets, 12));
      stubs.watch?.returns(mockSourcesChange(project, targets, [
        { workspaceNames: ['@org/workspace-a'], delay: 250},
      ]));
      const options: RunOptions = {
        cmd: 'build',
        mode: 'topological',
        force: false,
        args: [],
        env: {},
        watch: true,
        debounce: 8,
      }
      stubRun(stubs.run, [
        // Schedule 1
        { resolve: true, options, delay: 180 }, // (w-a)
        { resolve: true, options, delay: 220 }, // (w-b)
        { resolve: true, options, delay: 300 }, // (w-c) // +200ms
        { resolve: true, options, delay: 0 }, // (app-a)
        { resolve: true, options, delay: 0 }, // app-b)
        { resolve: true, options, delay: 0 }, // (api)
        // Schedule 2
        { resolve: true, options, delay: 200 }, // w-c // +550ms
        { resolve: true, options, delay: 20 }, // app-a // +750ms
        { resolve: true, options, delay: 20 }, // app-b
        { resolve: true, options, delay: 20 }, // (api)
      ]);
      try {
        const runner = new Runner(project, 2);
        const execution$ = runner.runCommand(options);
        await expectObservableV2(Date.now(), execution$, [
          [
            { type: RunCommandEventEnum.TARGETS_RESOLVED }, // +5ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-a' }, // +5ms (c1)
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-b' }, // +5ms (c2)
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-a' }, // +185ms (c1)
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-c' }, // +190ms (c2)
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/app-a' }, // +190ms
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/app-b' }, // +190ms
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/api' }, // +190ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-b' }, // +220ms (c1)
          ],
          [
            { type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/workspace-a' }, // +220ms
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/workspace-a' }, // +220ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-a' }, // +220ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-a' }, // +220ms
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-c' }, // +220ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-a' }, // +220ms
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-b' }, // +220ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-a' }, // +220ms
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-b' }, // +220ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/api' }, // +220ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/api' }, // +220ms
          ],
        ], 500);
      } catch (e) {
        expect(e).toBeFalsy();
      }
    });
    it('should handle correctly interruption in current step (queued node) - [topological]', async () => {
      const targets = [
        [
          { workspace: project.workspaces.get('@org/workspace-a')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/workspace-b')!, hasCommand: true },
        ],
        [
          { workspace: project.workspaces.get('@org/workspace-c')!, hasCommand: true },
        ],
        [
          { workspace: project.workspaces.get('@org/app-a')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-b')!, hasCommand: true },
        ],
        [
          { workspace: project.workspaces.get('@org/api')!, hasCommand: true },
        ]
      ]
      stubs.targets?.returns(resolveAfter(targets, 12));
      stubs.watch?.returns(mockSourcesChange(project, targets, [
        { workspaceNames: ['@org/workspace-c'], delay: 100},
      ]));
      stubRunV2(stubs.run, new Map([
        ['@org/workspace-a', [
          { resolve: true, delay: 200 },
        ]],
        ['@org/workspace-b', [
          { resolve: true, delay: 200 },
        ]],
        ['@org/workspace-c', [
          { resolve: true, delay: 300 },
        ]],
        ['@org/app-a', [
          { resolve: true, delay: 100 },
        ]],
        ['@org/app-b', [
          { resolve: true, delay: 100 },
        ]],
        ['@org/api', [
          { resolve: true, delay: 100 },
        ]],
      ]));
      try {
        const runner = new Runner(project, 2);
        const execution$ = runner.runCommand({
          cmd: 'build',
          mode: 'topological',
          force: false,
          args: [],
          env: {},
          watch: true,
          debounce: 8,
        });
        await expectObservableV2(Date.now(), execution$, [
          [
            { type: RunCommandEventEnum.TARGETS_RESOLVED }, // +20ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-a' },  // +20ms
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-b' },  // +20ms
          ],
          [
            { type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/workspace-c' },  // +140ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-a' }, // +220ms
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/workspace-c' },  // +140ms
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/app-a' }, // +220ms
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/app-b' }, // +220ms
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/api' }, // +220ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-c' },  // +20ms
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-b' }, // +220ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-c' }, // +220ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-a' }, // +220ms
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-b' }, // +220ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-a' }, // +220ms
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-b' }, // +220ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/api' }, // +220ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/api' }, // +220ms
          ],
        ], 550)
      } catch (e) {
        expect(e).toBeFalsy();
      }
    });
    it('should handle correctly multiple interruption complex scenario - [topological]', async () => {
      const targets = [
        [
          { workspace: project.workspaces.get('@org/workspace-a')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/workspace-b')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/workspace-c')!, hasCommand: true },
        ],
        [
          { workspace: project.workspaces.get('@org/app-a')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-b')!, hasCommand: true },
        ],
        [
          { workspace: project.workspaces.get('@org/api')!, hasCommand: true },
        ]
      ]
      stubs.targets?.returns(resolveAfter(targets, 12));
      stubs.watch?.returns(mockSourcesChange(project, targets, [
        { workspaceNames: ['@org/app-a'], delay: 100},
        { workspaceNames: ['@org/workspace-c'], delay: 120},
        { workspaceNames: ['@org/app-a'], delay: 300},
        { workspaceNames: ['@org/app-b'], delay: 320},
        { workspaceNames: ['@org/app-b'], delay: 400},
        { workspaceNames: ['@org/workspace-c'], delay: 550},
        { workspaceNames: ['@org/api'], delay: 570},
        { workspaceNames: ['@org/app-a'], delay: 620},
      ]));
      stubRunV2(stubs.run, new Map([
        ['@org/workspace-a', [
          { resolve: true, delay: 50 },
        ]],
        ['@org/workspace-b', [
          { resolve: true, delay: 50 },
        ]],
        ['@org/workspace-c', [
          { resolve: true, delay: 50 },
          { resolve: true, delay: 30 },
          { resolve: true, delay: 150 },
        ]],
        ['@org/app-a', [
          { resolve: true, delay: 100, killed: 30 }, // +70ms
          { resolve: true, delay: 50 }, // +170ms
          { resolve: true, delay: 50 }, // +310ms
          { resolve: true, delay: 20 },
        ]],
        ['@org/app-b', [
          { resolve: true, delay: 100, killed: 50 }, // +70ms
          { resolve: true, delay: 50 }, // +170ms
          { resolve: false, delay: 50 }, // +330ms
          { resolve: true, delay: 50 }, // +330ms
          { resolve: true, delay: 20 },
        ]],
        ['@org/api', [
          { resolve: true, delay: 20 },
          { resolve: true, delay: 20 },
          { resolve: true, delay: 20 },
        ]],
      ]));
      stubKill(stubs.kill, new Map([
        ['@org/app-a', [
          { cmd: 'build', delay: 50, pids: [34] },
        ]],
        ['@org/app-b', [{ cmd: 'build', delay: 20, pids: [34] }]],
      ]))
      try {
        const runner = new Runner(project, 4);
        const execution$ = runner.runCommand({
          cmd: 'build',
          mode: 'topological',
          force: false,
          args: [],
          env: {},
          watch: true,
          debounce: 8,
        });
        await expectObservableV2(Date.now(), execution$, [
          [
            { type: RunCommandEventEnum.TARGETS_RESOLVED }, // +20ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-a' },  // +20ms
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-b' },  // +20ms
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-c' },  // +20ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-a' },  // +70ms
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/app-a' }, // +70ms
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/app-b' }, // +70ms
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/api' }, // +70ms
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-b' },  // +70ms
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-c' },  // +70ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-a' },  // +70ms (-> killed @ +100ms)
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-b' },  // +70ms (-> killed @ +120ms)
          ],
          [
            { type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/app-a' },  // +100ms
            { type: RunCommandEventEnum.NODE_INTERRUPTING, workspace: '@org/app-a' },  // +100ms
          ],
          [
            { type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/workspace-c' },  // +120ms
            { type: RunCommandEventEnum.NODE_INTERRUPTING, workspace: '@org/app-b' },  // +120ms
          ],
          [
            { type: RunCommandEventEnum.NODE_INTERRUPTED, workspace: '@org/app-a' }, // +150ms
            { type: RunCommandEventEnum.NODE_INTERRUPTED, workspace: '@org/app-b' },  // +140ms
          ],
          [
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/workspace-c' },  // +140ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-c' },  // +150ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-c' }, // +170ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-a' }, // +170ms
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-b' }, // +170ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-a' }, // +220ms
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-b' }, // +220ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/api' }, // +220ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/api' }, // +240ms
          ],
          [
            { type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/app-a' }, // +300ms
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/app-a' }, // +310ms
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/api' }, // +310ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-a' }, // +310ms (-> +360ms)
          ],
          [
            { type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/app-b' }, // +320ms
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/app-b' }, // +330ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-b' }, // +330ms (-> + 380ms)
          ],
          [
            { type: RunCommandEventEnum.NODE_ERRORED, workspace: '@org/app-b' }, // +380ms
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-a' }, // +360ms
          ],
          [
            { type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/app-b' }, // +400ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-b' }, // +420ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-b' }, // +470ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/api' }, // +480ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/api' }, // +500ms
          ],
          [
            { type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/workspace-c' }, // +550ms
          ],
          [
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/workspace-c' }, // +550ms
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/app-a' }, // +550ms
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/app-b' }, // +550ms
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/api' }, // +550ms
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-c' }, // +550ms
          ],
          [
            { type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/api' }, // +560ms
          ],
          [
            { type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/app-a' }, // +620ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-c' }, // +700ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-a' }, // +700ms
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-b' }, // +700ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-a' }, // +710ms
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-b' }, // +710ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/api' }, // +710ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/api' }, // +720ms
          ],
        ], 750)
      } catch (e) {
        expect(e).toBeFalsy();
      }
    });
    it('should handle correctly add node event - [topological]', async () => {
      const targets1 = [
        [
          { workspace: project.workspaces.get('@org/workspace-a')!, hasCommand: true },
        ],
        [
          { workspace: project.workspaces.get('@org/app-a')!, hasCommand: true },
        ],
        [
          { workspace: project.workspaces.get('@org/api')!, hasCommand: true },
        ]
      ];
      const targets2 = [
        [
          { workspace: project.workspaces.get('@org/workspace-a')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/workspace-b')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/workspace-c')!, hasCommand: true },
        ],
        [
          { workspace: project.workspaces.get('@org/app-a')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-b')!, hasCommand: true },
        ],
        [
          { workspace: project.workspaces.get('@org/api')!, hasCommand: true },
        ]
      ]
      stubs.targets?.onCall(0).returns(resolveAfter(targets1, 5));
      stubs.targets?.onCall(1).returns(resolveAfter(targets2, 5));
      stubs.watch?.returns(mockSourcesChange(project, [], []));

      stubRunV2(stubs.run, new Map([
        ['@org/workspace-a', [
          { resolve: true, delay: 200 },
          { resolve: true, delay: 10, fromCache: true, },
        ]],
        ['@org/workspace-b', [
          { resolve: true, delay: 200 },
        ]],
        ['@org/workspace-c', [
          { resolve: true, delay: 100 },
        ]],
        ['@org/app-a', [
          { resolve: true, delay: 100 },
          { resolve: true, delay: 100 },
        ]],
        ['@org/app-b', [
          { resolve: true, delay: 100 },
        ]],
        ['@org/api', [
          { resolve: true, delay: 100 },
          { resolve: true, delay: 100 },
        ]],
      ]));
      const options: RunOptions = {
        cmd: 'build',
        mode: 'topological',
        force: false,
        args: [],
        env: {},
        watch: true,
        debounce: 8,
        to: [
          project.workspaces.get('@org/api')!,
        ]
      };
      try {
        const runner = new Runner(project, 4);
        const execution$ = runner.runCommand(options);
        setTimeout(() => {
          console.debug('Adding to scope');
          runner.addWorkspaces('build', [
            project.workspaces.get('@org/app-b')!,
          ])
        }, 500);
        await expectObservableV2(Date.now(), execution$, [
          [
            { type: RunCommandEventEnum.TARGETS_RESOLVED }, // +5ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-a' }, // +5ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-a' }, // +205ms
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/app-a' }, // +205ms
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/api' }, // +205ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-a' },  // +220ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-a' }, // +320ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/api' }, //+ 320ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/api' }, // +420ms
          ],
          [
            { type: RunCommandEventEnum.TARGETS_RESOLVED }, // +500ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-a' }, // +500ms
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-b' }, // +500ms
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-c' }, // +500ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-a' }, // +510ms
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/app-a' }, // +510ms
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/app-b' }, // +510ms
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/api' }, // +510ms
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-c' }, // +610ms
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-b' }, // +710ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-a' }, // +950ms
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-b' }, // +950ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-a' }, // +950ms
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-b' }, // +950ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/api' }, // +1150ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/api' }, // +1170ms
          ],
        ], 500)
      } catch (e) {
        expect(e).toBeFalsy();
      }
    });
    it('should start watching sources of added node - [topological]', async () => {
      const targets1 = [
        [
          { workspace: project.workspaces.get('@org/workspace-a')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/workspace-b')!, hasCommand: true },
        ],
        [
          { workspace: project.workspaces.get('@org/app-a')!, hasCommand: true },
        ],
        [
          { workspace: project.workspaces.get('@org/api')!, hasCommand: true },
        ]
      ];
      const targets2 = [
        [
          { workspace: project.workspaces.get('@org/workspace-a')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/workspace-b')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/workspace-c')!, hasCommand: true },
        ],
        [
          { workspace: project.workspaces.get('@org/app-a')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-b')!, hasCommand: true },
        ],
        [
          { workspace: project.workspaces.get('@org/api')!, hasCommand: true },
        ]
      ]
      stubs.targets?.onCall(0).returns(resolveAfter(targets1, 5));
      stubs.targets?.onCall(1).returns(resolveAfter(targets2, 5));
      stubs.watch?.onCall(0).returns(mockSourcesChange(project, [], []));
      stubs.watch?.onCall(1).returns(mockSourcesChange(project, targets2, [
        { delay: 500, workspaceNames: ['@org/workspace-c'] }
      ]));

      stubKill(stubs.kill, new Map([
        ['@org/workspace-a', [{cmd: 'build', delay: 20, pids: [22]} ]],
        ['@org/workspace-b', [{cmd: 'build', delay: 20, pids: [234]} ]],
      ]))
      stubRunV2(stubs.run, new Map([
        ['@org/workspace-a', [
          { resolve: true, delay: 200, killed: 100 },
          { resolve: true, delay: 10, fromCache: true, },
        ]],
        ['@org/workspace-b', [
          { resolve: true, delay: 200, killed: 100 },
          { resolve: true, delay: 200 },
        ]],
        ['@org/workspace-c', [
          { resolve: true, delay: 100 },
          { resolve: true, delay: 10 },
        ]],
        ['@org/app-a', [
          { resolve: true, delay: 100 },
          { resolve: true, delay: 100 },
          { resolve: true, delay: 10 },
        ]],
        ['@org/app-b', [
          { resolve: true, delay: 100 },
          { resolve: true, delay: 10 },
        ]],
        ['@org/api', [
          { resolve: true, delay: 100 },
          { resolve: true, delay: 100 },
          { resolve: true, delay: 10 },
        ]],
      ]));
      const options: RunOptions = {
        cmd: 'build',
        mode: 'topological',
        force: false,
        args: [],
        env: {},
        watch: true,
        debounce: 8,
        to: [
          project.workspaces.get('@org/api')!,
        ]
      };
      try {
        const runner = new Runner(project, 4);
        const execution$ = runner.runCommand(options);
        setTimeout(() => {
          console.debug('Adding to scope');
          runner.addWorkspaces('build', [
            project.workspaces.get('@org/app-b')!,
          ])
        }, 100);
        await expectObservableV2(Date.now(), execution$, [
          [
            { type: RunCommandEventEnum.TARGETS_RESOLVED }, // +5ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-a' }, // +5ms
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-b' }, // +5ms
          ],
          [
            { type: RunCommandEventEnum.TARGETS_RESOLVED }, // +5ms
          ],
          [
            { type: RunCommandEventEnum.NODE_INTERRUPTING, workspace: '@org/workspace-a' }, // +5ms
            { type: RunCommandEventEnum.NODE_INTERRUPTING, workspace: '@org/workspace-b' }, // +5ms
          ],
          [
            { type: RunCommandEventEnum.NODE_INTERRUPTED, workspace: '@org/workspace-a' }, // +5ms
            { type: RunCommandEventEnum.NODE_INTERRUPTED, workspace: '@org/workspace-b' }, // +5ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-a' }, // +500ms
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-b' }, // +500ms
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-c' }, // +500ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-a' }, // +510ms
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/app-a' }, // +510ms
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/app-b' }, // +510ms
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/api' }, // +510ms
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-c' }, // +610ms
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-b' }, // +710ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-a' }, // +950ms
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-b' }, // +950ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-a' }, // +950ms
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-b' }, // +950ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/api' }, // +1150ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/api' }, // +1170ms
          ],
          [
            { type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/workspace-c' }, // +500ms
          ],
          [
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/workspace-c' }, // +510ms
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/app-a' }, // +510ms
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/app-b' }, // +510ms
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/api' }, // +510ms
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-c' }, // +500ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-c' }, // +500ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-a' }, // +950ms
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-b' }, // +950ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-a' }, // +950ms
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-b' }, // +950ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/api' }, // +1150ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/api' }, // +1170ms
          ],
        ], 500)
      } catch (e) {
        expect(e).toBeFalsy();
      }
    });
    it('should handle correctly remove node event and stop watching sources of removed target - [topological]', async () => {
      const targets1 = [
        [
          { workspace: project.workspaces.get('@org/workspace-a')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/workspace-b')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/workspace-c')!, hasCommand: true },
        ],
        [
          { workspace: project.workspaces.get('@org/app-a')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-b')!, hasCommand: true },
        ],
        [
          { workspace: project.workspaces.get('@org/api')!, hasCommand: true },
        ]
      ]
      const targets2 = [
        [
          { workspace: project.workspaces.get('@org/workspace-a')!, hasCommand: true },
          { workspace: project.workspaces.get('@org/workspace-b')!, hasCommand: true },
        ],
        [
          { workspace: project.workspaces.get('@org/app-a')!, hasCommand: true },
        ],
        [
          { workspace: project.workspaces.get('@org/api')!, hasCommand: true },
        ]
      ];

      stubs.targets?.onCall(0).returns(resolveAfter(targets1, 5));
      stubs.targets?.onCall(1).returns(resolveAfter(targets2, 5));
      stubs.watch?.onCall(0).returns(mockSourcesChange(project, [], []));
      stubs.watch?.onCall(1).returns(mockSourcesChange(project, targets2, [
        { delay: 500, workspaceNames: ['@org/workspace-c'] }
      ]));

      stubKill(stubs.kill, new Map([
        ['@org/workspace-a', [{cmd: 'build', delay: 20, pids: [22]} ]],
        ['@org/workspace-b', [{cmd: 'build', delay: 20, pids: [234]} ]],
        ['@org/workspace-c', [{cmd: 'build', delay: 20, pids: [234]} ]],
      ]))
      stubRunV2(stubs.run, new Map([
        ['@org/workspace-a', [
          { resolve: true, delay: 200, killed: 100 },
          { resolve: true, delay: 10, fromCache: true, },
        ]],
        ['@org/workspace-b', [
          { resolve: true, delay: 200, killed: 100 },
          { resolve: true, delay: 200 },
        ]],
        ['@org/workspace-c', [
          { resolve: true, delay: 200, killed: 100 },
        ]],
        ['@org/app-a', [
          { resolve: true, delay: 100 },
          { resolve: true, delay: 10 },
        ]],
        ['@org/app-b', [
          { resolve: true, delay: 10000 }, // not subscribed
        ]],
        ['@org/api', [
          { resolve: true, delay: 10000 }, // not subscribed
          { resolve: true, delay: 10 },
        ]],
      ]));
      const options: RunOptions = {
        cmd: 'build',
        mode: 'topological',
        force: false,
        args: [],
        env: {},
        watch: true,
        debounce: 8,
        to: [
          project.workspaces.get('@org/api')!,
          project.workspaces.get('@org/app-b')!,
        ]
      };
      try {
        const runner = new Runner(project, 4);
        const execution$ = runner.runCommand(options);
        setTimeout(() => {
          console.debug('Adding to scope');
          runner.removeWorkspace('build', [
            project.workspaces.get('@org/app-b')!,
          ])
        }, 100);
        await expectObservableV2(Date.now(), execution$, [
          [
            { type: RunCommandEventEnum.TARGETS_RESOLVED }, // +5ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-a' }, // +5ms
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-b' }, // +5ms
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-c' }, // +5ms
          ],
          [
            { type: RunCommandEventEnum.TARGETS_RESOLVED }, // +5ms
          ],
          [
            { type: RunCommandEventEnum.NODE_INTERRUPTING, workspace: '@org/workspace-a' }, // +5ms
            { type: RunCommandEventEnum.NODE_INTERRUPTING, workspace: '@org/workspace-b' }, // +5ms
            { type: RunCommandEventEnum.NODE_INTERRUPTING, workspace: '@org/workspace-c' }, // +5ms
          ],
          [
            { type: RunCommandEventEnum.NODE_INTERRUPTED, workspace: '@org/workspace-a' }, // +5ms
            { type: RunCommandEventEnum.NODE_INTERRUPTED, workspace: '@org/workspace-b' }, // +5ms
            { type: RunCommandEventEnum.NODE_INTERRUPTED, workspace: '@org/workspace-c' }, // +5ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-a' }, // +500ms
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-b' }, // +500ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-a' }, // +510ms
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/app-a' }, // +510ms
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/api' }, // +510ms
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-b' }, // +710ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-a' }, // +950ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-a' }, // +950ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/api' }, // +1150ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/api' }, // +1170ms
          ],
        ], 500)
      } catch (e) {
        expect(e).toBeFalsy();
      }
    });
    it.todo('should handle complex scenarios were adding/removing nodes - [topological]');
    it.todo('should handle system events while re-computing targets - [topological]');
  });
});
