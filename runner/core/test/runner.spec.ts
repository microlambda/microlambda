import {getProject} from './mocks/utils';
import {SinonStub, stub} from 'sinon';
import {Project, RunCommandEventEnum, Runner, RunOptions, TargetsResolver, Workspace} from '../src';
import {
  expectObservable,
  expectObservableV2,
  ObservableEvent,
  resolveAfter,
  stubKill,
  stubRun,
  stubRunV2
} from './utils/runner-observable';
import {delay, from, mergeAll, Observable, of} from "rxjs";
import {Watcher, WatchEvent} from "../src/watcher";

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
    stubs.invalidate = stub(Workspace.prototype, 'invalidateLocalCache');
    stubs.isDaemon = stub(Workspace.prototype, 'isDaemon');
    stubs.kill = stub(Workspace.prototype, 'kill');
    stubs.kill.rejects();
    stubs.isDaemon.returns(false);
    stubs.isDaemon.withArgs('start').returns(true);
    stubs.invalidate.resolves();
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
          { workspace: project.workspaces.get('@org/workspace-a')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/workspace-b')!, affected: true, hasCommand: false },
          { workspace: project.workspaces.get('@org/workspace-c')!, affected: false, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-a')!, affected: false, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-b')!, affected: true, hasCommand: false },
          { workspace: project.workspaces.get('@org/api')!, affected: true, hasCommand: true },
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
          { workspace: project.workspaces.get('@org/workspace-a')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/workspace-b')!, affected: true, hasCommand: false },
          { workspace: project.workspaces.get('@org/workspace-c')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-a')!, affected: false, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-b')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/api')!, affected: true, hasCommand: true },
        ]
      ], 12));
      const options: RunOptions = {
        cmd: 'lint',
        mode: 'parallel',
        force: false,
      };
      stubRun(stubs.run, [
        { resolve: true, options, delay: 14 },
        { resolve: false, options, delay: 7, error: new Error('Unexpected') },
        { resolve: true, options, delay: 13 },
        { resolve: true, options, delay: 23 },
      ])
      try {
        const runner = new Runner(project, 4);
        const execution$ = runner.runCommand(options);
        await expectObservable(Date.now(), execution$, '0-443333-11152', {
          4: ['@org/workspace-b', '@org/app-a'],
          3: ['@org/workspace-a',  '@org/app-b',  '@org/workspace-c', '@org/api'],
        }, (events) => {
          const invalidation = events.find((e) => e.type === RunCommandEventEnum.CACHE_INVALIDATED);
          const error = events.find((e) => e.type === RunCommandEventEnum.NODE_ERRORED);
          expect(invalidation).toBeTruthy();
          expect(invalidation?.workspace).toBe(error?.workspace);
        });
      } catch (e) {
        expect(e).toBeFalsy();
      }
    });
    it('should run command from leaves to roots - topological', async () => {
      stubs.targets?.returns(resolveAfter([
        [
          { workspace: project.workspaces.get('@org/workspace-a')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/workspace-c')!, affected: true, hasCommand: true },
        ],
        [
          { workspace: project.workspaces.get('@org/workspace-b')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-a')!, affected: true, hasCommand: true },
        ],
        [
          { workspace: project.workspaces.get('@org/api')!, affected: true, hasCommand: true },
        ],
        [
          { workspace: project.workspaces.get('@org/app-b')!, affected: true, hasCommand: true },
        ]
      ], 12));
      const options: RunOptions = {
        cmd: 'build',
        mode: 'topological',
        force: false,
      };
      stubRun(stubs.run, [
        { resolve: true, options, delay: 14 },
        { resolve: true, options, delay: 7 },
        { resolve: true, options, delay: 13 },
        { resolve: true, options, delay: 23 },
        { resolve: true, options, delay: 12 },
        { resolve: true, options, delay: 4 },
      ])
      try {
        const runner = new Runner(project, 4);
        const execution$ = runner.runCommand(options);
        await expectObservable(Date.now(), execution$, '0-33-115555-33-1155-3-15-3-1', {
          1: ['@org/workspace-b', '@org/app-a', '@org/workspace-a',  '@org/app-b',  '@org/workspace-c', '@org/api'],
          3: ['@org/workspace-b', '@org/app-a', '@org/workspace-a',  '@org/app-b',  '@org/workspace-c', '@org/api'],
        }, (events) => {
          const invalidations: string[] = events
            .filter((evt) => evt.type === RunCommandEventEnum.CACHE_INVALIDATED)
            .map((evt) => String(evt.workspace));
          expect(invalidations.slice(0, 4).sort()).toEqual(['@org/workspace-b', '@org/api', '@org/app-b', '@org/app-a'].sort());
          expect(invalidations.slice(4, 6).sort()).toEqual(['@org/api', '@org/app-b'].sort());
          expect(invalidations.slice(6, 7).sort()).toEqual(['@org/app-b']);
        });
      } catch (e) {
        expect(e).toBeFalsy();
      }
    });
    it('should terminate and invalidate cache of subsequent workspaces if a command fail in a workspace - topological', async () => {
      stubs.targets?.returns(resolveAfter([
        [
          { workspace: project.workspaces.get('@org/workspace-a')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/workspace-c')!, affected: true, hasCommand: true },
        ],
        [
          { workspace: project.workspaces.get('@org/workspace-b')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-a')!, affected: true, hasCommand: true },
        ],
        [
          { workspace: project.workspaces.get('@org/api')!, affected: true, hasCommand: true },
        ],
        [
          { workspace: project.workspaces.get('@org/app-b')!, affected: true, hasCommand: true },
        ]
      ], 12));
      const options: RunOptions = {
        cmd: 'build',
        mode: 'topological',
        force: false,
      };
      stubRun(stubs.run, [
        { resolve: true, options, delay: 14, fromCache: true },
        { resolve: true, options, delay: 7, fromCache: true },
        { resolve: true, options, delay: 13, fromCache: true },
        { resolve: false, options, delay: 23 },
        { resolve: true, options, delay: 12 },
        { resolve: true, options, delay: 4 },
      ]);
      try {
        const runner = new Runner(project, 4);
        const execution$ = runner.runCommand(options);
        await expectObservable(Date.now(), execution$, '0-33-11-33-12555-X', {
          1: ['@org/workspace-b', '@org/workspace-a', '@org/workspace-c'],
          2: ['@org/app-a'],
          3: ['@org/workspace-b', '@org/app-a', '@org/workspace-a', '@org/workspace-c'],
          5: ['@org/app-a', '@org/api', '@org/app-b'],
        });
      } catch (e) {
        expect(e).toBeFalsy();
      }
    });
    it('should invalidate cache of subsequent workspaces if a command must be re-run in a workspace - topological', async () => {
      stubs.targets?.returns(resolveAfter([
        [
          { workspace: project.workspaces.get('@org/workspace-a')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/workspace-c')!, affected: true, hasCommand: true },
        ],
        [
          { workspace: project.workspaces.get('@org/workspace-b')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-a')!, affected: true, hasCommand: true },
        ],
        [
          { workspace: project.workspaces.get('@org/api')!, affected: true, hasCommand: true },
        ],
        [
          { workspace: project.workspaces.get('@org/app-b')!, affected: true, hasCommand: true },
        ]
      ], 12));
      const options: RunOptions = {
        cmd: 'build',
        mode: 'topological',
        force: false,
      };
      stubRun(stubs.run, [
        { resolve: true, options, delay: 14, fromCache: true },
        { resolve: true, options, delay: 7, fromCache: true },
        { resolve: true, options, delay: 13, fromCache: true },
        { resolve: true, options, delay: 23 },
        { resolve: true, options, delay: 12 },
        { resolve: true, options, delay: 4 },
      ])
      try {
        const runner = new Runner(project, 4);
        const execution$ = runner.runCommand(options);
        await expectObservable(Date.now(), execution$, '0-33-11-33-1155-3-15-3-1', {
          1: ['@org/workspace-b', '@org/app-a', '@org/workspace-a',  '@org/app-b',  '@org/workspace-c', '@org/api'],
          3: ['@org/workspace-b', '@org/app-a', '@org/workspace-a',  '@org/app-b',  '@org/workspace-c', '@org/api'],
          5: ['@org/api', '@org/app-b', '@org/app-b'],
        });
      } catch (e) {
        expect(e).toBeFalsy();
      }
    });
    it('should terminate on cache invalidation error  - parallel', async () => {
      stubs.targets?.returns(resolveAfter([
        [
          { workspace: project.workspaces.get('@org/workspace-a')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/workspace-b')!, affected: true, hasCommand: false },
          { workspace: project.workspaces.get('@org/workspace-c')!, affected: false, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-a')!, affected: false, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-b')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/api')!, affected: true, hasCommand: true },
        ]
      ], 12));
      stubs.invalidate?.rejects();
      const options: RunOptions = {
        cmd: 'lint',
        mode: 'parallel',
        force: false,
      };
      stubRun(stubs.run, [
        { resolve: true, options, delay: 14 },
        { resolve: true, options, delay: 8 },
        { resolve: false, options, delay: 23 },
      ])
      try {
        const runner = new Runner(project, 4);
        const execution$ = runner.runCommand(options);
        await expectObservable(Date.now(), execution$, '0-444333-1126-X', {
          1: ['@org/workspace-a', '@org/app-b'],
          2: ['@org/api'],
          4: ['@org/workspace-c', '@org/workspace-b', '@org/app-a'],
          3: ['@org/workspace-a', '@org/app-b', '@org/api'],
          5: [],
          6: ['@org/api'],
        });
      } catch (e) {
        expect(e).toBeFalsy();
      }
    });
    it('should terminate on cache invalidation error  - topological', async () => {
      stubs.targets?.returns(resolveAfter([
        [
          { workspace: project.workspaces.get('@org/workspace-a')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/workspace-c')!, affected: true, hasCommand: true },
        ],
        [
          { workspace: project.workspaces.get('@org/workspace-b')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-a')!, affected: true, hasCommand: true },
        ],
        [
          { workspace: project.workspaces.get('@org/api')!, affected: true, hasCommand: true },
        ],
        [
          { workspace: project.workspaces.get('@org/app-b')!, affected: true, hasCommand: true },
        ]
      ], 12));
      const options: RunOptions = {
        cmd: 'build',
        mode: 'topological',
        force: false,
      };
      stubRun(stubs.run, [
        { resolve: true, options, delay: 14, fromCache: true },
        { resolve: true, options, delay: 7, fromCache: true },
        { resolve: true, options, delay: 13, fromCache: true },
        { resolve: false, options, delay: 23 },
        { resolve: true, options, delay: 12 },
        { resolve: true, options, delay: 4 },
      ]);
      stubs.invalidate?.onCall(0).resolves();
      stubs.invalidate?.onCall(1).rejects();
      stubs.invalidate?.onCall(2).resolves();
      try {
        const runner = new Runner(project, 4);
        const execution$ = runner.runCommand(options);
        await expectObservable(Date.now(), execution$, '0-33-11-33-12556-X', {
          1: ['@org/workspace-b', '@org/workspace-a', '@org/workspace-c'],
          2: ['@org/app-a'],
          3: ['@org/workspace-b', '@org/app-a', '@org/workspace-a', '@org/workspace-c'],
          5: ['@org/app-a', '@org/app-b'],
          6: ['@org/api'],
        });
      } catch (e) {
        expect(e).toBeFalsy();
      }
    });
  });
  describe('[method] runCommand (watch mode)', () => {
    const mockSourcesChange = (changes: Array<{ workspaceNames: string[], delay: number }>): Observable<Array<WatchEvent>> => {
      const fakeEvents$: Array<Observable<Array<WatchEvent>>> = changes.map((changes) => {
        return of(changes.workspaceNames.map((w) => ({
          target: {
            workspace: project.workspaces.get(w)!,
            affected: true,
            hasCommand: true,
          },
          events: [{
            event: 'change' as const,
            path: '/what/ever'
          }]
        }))).pipe(delay(changes.delay));
      });
      return from(fakeEvents$).pipe(mergeAll());
    };
    it('should handle single-interruption in running step and when idle - [parallel]', async () => {
      stubs.targets?.returns(resolveAfter([
        [
          { workspace: project.workspaces.get('@org/workspace-a')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/workspace-b')!, affected: true, hasCommand: false },
          { workspace: project.workspaces.get('@org/workspace-c')!, affected: false, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-a')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-b')!, affected: true, hasCommand: false },
          { workspace: project.workspaces.get('@org/api')!, affected: true, hasCommand: true },
        ]
      ], 12));

      const options: RunOptions = {
        cmd: 'lint',
        mode: 'parallel',
        force: false,
        args: [],
        env: {},
        watch: true,
        debounce: 8,
      };
      stubs.watch?.returns(mockSourcesChange([
        { workspaceNames: ['@org/api'], delay: 150},
        { workspaceNames: ['@org/app-a'], delay: 450},
      ]));
      stubRunV2(stubs.run, new Map([
        ['@org/workspace-a', [
          { resolve: true, delay: 80 },
        ]],
        ['@org/api', [
          { resolve: true, delay: 200 },
          { resolve: true, delay: 90 },
        ]],
        ['@org/app-a', [
          { resolve: true, delay: 120 },
          { resolve: true, delay: 110 },
        ]]
      ]));
      stubKill(stubs.kill, new Map([
        ['@org/app-a', [{cmd: 'lint', delay: 1} ]],
        ['@org/api', [{cmd: 'lint', delay: 2} ]],
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
              { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-a' },
              { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/api' },
              { type: RunCommandEventEnum.NODE_SKIPPED, workspace: '@org/workspace-b' },
              { type: RunCommandEventEnum.NODE_SKIPPED, workspace: '@org/workspace-c' },
              { type: RunCommandEventEnum.NODE_SKIPPED, workspace: '@org/app-b' },
            ],
            [
              { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-a' },
            ],
            [
              { type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/api' },
              { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-a' },
            ],
            [
              { type: RunCommandEventEnum.NODE_INTERRUPTED, workspace: '@org/api' },
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
              { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-a' },
            ],
            [
              { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-a' },
            ],
          ],
          700,
        )
      } catch (e) {
        expect(e).toBeFalsy();
      }
    });
    it('should do nothing if impacted process has not started yet - [parallel]', async () => {
      stubs.targets?.returns(resolveAfter([
        [
          { workspace: project.workspaces.get('@org/workspace-a')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/workspace-b')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/workspace-c')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-a')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-b')!, affected: true, hasCommand: false },
          { workspace: project.workspaces.get('@org/api')!, affected: true, hasCommand: true },
        ]
      ], 12));
      stubs.watch?.returns(mockSourcesChange([
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
      stubRun(stubs.run, [
        // Initial
        // 0-333444-1-78-1-31-7-3-1
        { resolve: true, options, delay: 100 }, // +0ms
        { resolve: true, options, delay: 100 },

        { resolve: true, options, delay: 100 }, // +100ms
        { resolve: true, options, delay: 100 },

        { resolve: true, options, delay: 100 }, // + 200ms
      ]);
      try {
        const runner = new Runner(project, 2);
        const execution$ = runner.runCommand(options);
        await expectObservable(Date.now(), execution$, '0-33-7-1133-7-1134-1', {}, undefined, 500);
      } catch (e) {
        expect(e).toBeFalsy();
      }
    });
    it('should do nothing if impacted target is not affected - [parallel]', async () => {
      stubs.targets?.returns(resolveAfter([
        [
          { workspace: project.workspaces.get('@org/workspace-a')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/workspace-b')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/workspace-c')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-a')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-b')!, affected: true, hasCommand: false },
          { workspace: project.workspaces.get('@org/api')!, affected: false, hasCommand: true },
        ]
      ], 12));
      stubs.watch?.returns(mockSourcesChange([
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
      stubRun(stubs.run, [
        // Initial
        // 0-333444-1-78-1-31-7-3-1
        { resolve: true, options, delay: 100 }, // +0ms
        { resolve: true, options, delay: 100 },
        { resolve: true, options, delay: 100 },
        { resolve: true, options, delay: 100 },
        // +100ms
      ]);
      try {
        const runner = new Runner(project, 8);
        const execution$ = runner.runCommand(options);
        await expectObservable(Date.now(), execution$, '0-333344-7-1111', {}, undefined, 500);
      } catch (e) {
        expect(e).toBeFalsy();
      }
    });
    it('should handle correctly multiple interruption - [parallel]', async () => {
      stubs.targets?.returns(resolveAfter([
        [
          { workspace: project.workspaces.get('@org/workspace-a')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/workspace-b')!, affected: true, hasCommand: false },
          { workspace: project.workspaces.get('@org/workspace-c')!, affected: false, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-a')!, affected: false, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-b')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/api')!, affected: true, hasCommand: true },
        ]
      ], 12));
      stubs.watch?.returns(mockSourcesChange([
        // During First round
        { workspaceNames: ['@org/workspace-a', '@org/workspace-c'], delay: 130},
        { workspaceNames: ['@org/api'], delay: 65},
        // During first recompile
        { workspaceNames: ['@org/api', '@org/workspace-b'], delay: 350},
        { workspaceNames: ['@org/workspace-c'], delay: 400},

        // After first recompile
        { workspaceNames: ['@org/app-a', '@org/workspace-a', '@org/workspace-c'], delay: 600},
        { workspaceNames: ['@org/app-b'], delay: 650},

      ]));

      stubKill(stubs.kill, new Map([
        ['@org/workspace-a', [{cmd: 'lint', delay: 1}, {cmd: 'lint', delay: 1}]],
        ['@org/workspace-c', [{cmd: 'lint', delay: 1}, {cmd: 'lint', delay: 1}]],
        ['@org/app-a', [{cmd: 'lint', delay: 1}]],
        ['@org/app-b', [{cmd: 'lint', delay: 1}]],
        ['@org/api', [{cmd: 'lint', delay: 1}, {cmd: 'lint', delay: 1}]],
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
      stubRun(stubs.run, [
        // First round
        { resolve: true, options, delay: 200 }, // + 0ms //w-a
        { resolve: true, options, delay: 250 }, // app-b
        { resolve: true, options, delay: 200 }, // api
        // First recompile
        { resolve: true, options, delay: 220 }, // +250ms (w-a)
        { resolve: true, options, delay: 240 }, // (api)
        // Second recompile
        { resolve: true, options, delay: 220 }, // ~ +500ms (api)
        // Second round
        { resolve: true, options, delay: 26 }, // (workspace-a-a)
        { resolve: true, options, delay: 23 }, // (app-b)
      ])
      try {
        const runner = new Runner(project, 8);
        const execution$ = runner.runCommand(options);
        await expectObservable(Date.now(), execution$, '0-444333-777881-33-77781-3-17777-33-11', {}, undefined, 500);
      } catch (e) {
        expect(e).toBeFalsy();
      }
    });
    it('should handle correctly errored node - [parallel]', async () => {
      stubs.targets?.returns(resolveAfter([
        [
          { workspace: project.workspaces.get('@org/workspace-a')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/workspace-b')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/workspace-c')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-a')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-b')!, affected: true, hasCommand: false },
          { workspace: project.workspaces.get('@org/api')!, affected: false, hasCommand: true },
        ]
      ], 12));
      stubs.watch?.returns(mockSourcesChange([
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
      stubRun(stubs.run, [
        // Initial
        { resolve: false, options, delay: 100, error: new Error('Mocked') }, // +0ms w-a
        { resolve: true, options, delay: 400 }, // wb
        { resolve: true, options, delay: 120 }, // wc
        { resolve: true, options, delay: 100 }, // +400ms // app-a
        // + 250ms - recompile workspace-a
        { resolve: true, options, delay: 100 }, // +550ms // w-a
        // + 600ms - broke app-a
        { resolve: false, options, delay: 100, error: new Error('Mocked') }, // app-a
        // + 750ms -fix
        { resolve: true, options, delay: 100 }, // app-a
      ]);
      try {
        const runner = new Runner(project, 8);
        const execution$ = runner.runCommand(options);
        /*

              { type: 3, workspace: '@org/workspace-a' },
      { type: 3, workspace: '@org/workspace-b' },
      { type: 3, workspace: '@org/workspace-c' },
      { type: 3, workspace: '@org/app-a' },

      { type: 7, workspace: '@org/workspace-a' },
      { type: 3, workspace: '@org/workspace-a' },
      { type: 1, workspace: '@org/workspace-b' },
         */
        await expectObservable(Date.now(), execution$, '0-333344-251171-31-7-3-25-7-3-1', {}, undefined, 500);
      } catch (e) {
        expect(e).toBeFalsy();
      }
    });
    it.skip('should restart daemon process on changes - [parallel]', async () => {
      stubs.targets?.returns(resolveAfter([
        [
          { workspace: project.workspaces.get('@org/workspace-a')!, affected: true, hasCommand: false },
          { workspace: project.workspaces.get('@org/workspace-b')!, affected: true, hasCommand: false },
          { workspace: project.workspaces.get('@org/workspace-c')!, affected: true, hasCommand: false },
          { workspace: project.workspaces.get('@org/app-a')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-b')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/api')!, affected: true, hasCommand: false },
        ]
      ], 10));
      stubs.watch?.returns(mockSourcesChange([
        { workspaceNames: ['@org/workspace-a'], delay: 80},
        { workspaceNames: ['@org/app-a'], delay: 100},
        { workspaceNames: ['@org/app-a'], delay: 110},
        { workspaceNames: ['@org/app-b'], delay: 120},
        { workspaceNames: ['@org/app-b'], delay: 300},
      ]));
      const options: RunOptions = {
        cmd: 'start',
        mode: 'parallel',
        force: true,
        watch: true,
        debounce: 50,
      };

      stubRun(stubs.run, [
        // Initial
        { resolve: true, options, delay: 40 }, // +0ms app-a
        { resolve: true, options, delay: 60 }, // +0ms app-b
        { resolve: true, options, delay: 30 }, // +150ms app-a
        { resolve: true, options, delay: 70 }, // +150ms app-b
      ]);

      try {
        const runner = new Runner(project, 8);
        const execution$ = runner.runCommand(options);
        await expectObservable(Date.now(), execution$, '0-334444-11-7777-88-33-11-7-8-3-1', {}, undefined, 500);
      } catch (e) {
        expect(e).toBeFalsy();
      }
    })
    it.todo('should restart daemon when flagged as failed - [parallel]');
    it('should restart daemon when flagged as succeed - [parallel]', async () => {
      stubs.targets?.returns(resolveAfter([
        [
          { workspace: project.workspaces.get('@org/workspace-a')!, affected: false, hasCommand: false },
          { workspace: project.workspaces.get('@org/workspace-b')!, affected: false, hasCommand: false },
          { workspace: project.workspaces.get('@org/workspace-c')!, affected: false, hasCommand: false },
          { workspace: project.workspaces.get('@org/app-a')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-b')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/api')!, affected: true, hasCommand: true },
        ]
      ], 14));

      stubKill(stubs.kill, new Map([
        ['@org/app-a', [{cmd: 'start', delay: 1} ]],
        ['@org/api', [{cmd: 'start', delay: 2} ]],
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

      stubs.watch?.returns(mockSourcesChange([
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
            { type: RunCommandEventEnum.NODE_INTERRUPTED, workspace: '@org/app-a' },
            { type: RunCommandEventEnum.NODE_INTERRUPTED, workspace: '@org/api' },
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-a' },
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/api' },
          ],
          [
            { type: RunCommandEventEnum.NODE_ERRORED, workspace: '@org/app-a' },
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/app-a' },
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/api' },
          ]
        ], 250)
      } catch (e) {
        expect(e).toBeFalsy();
      }
    });
    it.todo('should restart daemon when starting and file change - [parallel]');
    it.todo('should handle correctly add node event - [parallel]');
    it.todo('should start watching sources of added node - [parallel]');
    it.todo('should handle correctly remove node event - [parallel]');
    it.todo('should stop watching sources of removed node - [parallel]');
    it('should handle correctly interruption in previous step - [topological]', async () => {
      stubs.targets?.returns(resolveAfter([
        [
          { workspace: project.workspaces.get('@org/workspace-a')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/workspace-b')!, affected: true, hasCommand: true },
        ],
        [
          { workspace: project.workspaces.get('@org/workspace-c')!, affected: true, hasCommand: true },
        ],
        [
          { workspace: project.workspaces.get('@org/app-a')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-b')!, affected: true, hasCommand: true },
        ],
        [
          { workspace: project.workspaces.get('@org/api')!, affected: true, hasCommand: true },
        ]
      ], 12));
      stubs.watch?.returns(mockSourcesChange([
        { workspaceNames: ['@org/workspace-a'], delay: 320},
        { workspaceNames: ['@org/workspace-a'], delay: 840},
        { workspaceNames: ['@org/app-a'], delay: 1200},
      ]));
      stubKill(stubs.kill, new Map([
        ['@org/workspace-a', [{cmd: 'build', delay: 1}, {cmd: 'build', delay: 1}]],
        ['@org/workspace-c', [{cmd: 'build', delay: 1}]],
        ['@org/app-a', [{cmd: 'build', delay: 1}]],
        ['@org/app-b', [{cmd: 'build', delay: 1}]],
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
        { resolve: true, options, delay: 0 }, // (app-a)
        { resolve: true, options, delay: 0 }, // app-b)
        { resolve: true, options, delay: 0 }, // (api)
        // Schedule 2
        { resolve: true, options, delay: 200 }, // (w-a) // +350ms
        { resolve: true, options, delay: 200 }, // w-c // +550ms
        { resolve: true, options, delay: 200 }, // app-a // +750ms
        { resolve: true, options, delay: 200 }, // app-b
        { resolve: true, options, delay: 0 }, // (api)
        // Schedule 3
        { resolve: true, options, delay: 200 }, // w-a // +870ms
        { resolve: true, options, delay: 20 }, // w-c // +890ms
        { resolve: true, options, delay: 20 }, // app-a // +910ms
        { resolve: true, options, delay: 20 }, // app-b //
        { resolve: true, options, delay: 20 }, // api // +930ms
        // Schedule 4 (idle)
        { resolve: true, options, delay: 20 }, // app-a // +910ms
        { resolve: true, options, delay: 20 }, // api // +930ms
      ]);
      try {
        const runner = new Runner(project, 4);
        const execution$ = runner.runCommand(options);
        await expectObservable(Date.now(), execution$, '0-33-11-5555-3-78-3-1-5555-3-1-555-33-788-3-1-5555-3-1-555-33-11-5-3-1-7-3-1-5-3-1', {}, undefined, 500);
      } catch (e) {
        expect(e).toBeFalsy();
      }
    });
    it('should handle correctly interruption in subsequent step - [topological]', async () => {
      stubs.targets?.returns(resolveAfter([
        [
          { workspace: project.workspaces.get('@org/workspace-a')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/workspace-b')!, affected: true, hasCommand: true },
        ],
        [
          { workspace: project.workspaces.get('@org/workspace-c')!, affected: true, hasCommand: true },
        ],
        [
          { workspace: project.workspaces.get('@org/app-a')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-b')!, affected: true, hasCommand: true },
        ],
        [
          { workspace: project.workspaces.get('@org/api')!, affected: true, hasCommand: true },
        ]
      ], 12));
      stubs.watch?.returns(mockSourcesChange([
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
        { resolve: true, options, delay: 100 }, // (app-a)
        { resolve: true, options, delay: 200 }, // app-b)
        { resolve: true, options, delay: 100 }, // (api)
        // Schedule 2
      ]);
      try {
        const runner = new Runner(project, 4);
        const execution$ = runner.runCommand(options);
        await expectObservable(Date.now(), execution$, '0-337-11-5555-37-1-555-337115-3-1', {}, undefined, 500);
      } catch (e) {
        expect(e).toBeFalsy();
      }
    });
    it('should handle correctly interruption in current step (running node) - [topological]', async () => {
      stubs.targets?.returns(resolveAfter([
        [
          { workspace: project.workspaces.get('@org/workspace-a')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/workspace-b')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/workspace-c')!, affected: true, hasCommand: true },
        ],
        [
          { workspace: project.workspaces.get('@org/app-a')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-b')!, affected: true, hasCommand: true },
        ],
        [
          { workspace: project.workspaces.get('@org/api')!, affected: true, hasCommand: true },
        ]
      ], 12));
      stubs.watch?.returns(mockSourcesChange([
        { workspaceNames: ['@org/workspace-b'], delay: 150},
      ]));

      stubKill(stubs.kill, new Map([
        ['@org/workspace-b', [{cmd: 'build', delay: 1}]],
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
        { resolve: true, options, delay: 0 }, // (app-a)
        { resolve: true, options, delay: 0 }, // app-b)
        { resolve: true, options, delay: 0 }, // (api)
        // Schedule 2
        { resolve: true, options, delay: 200 }, // w-b // +550ms
        { resolve: true, options, delay: 20 }, // app-a // +750ms
        { resolve: true, options, delay: 20 }, // app-b
        { resolve: true, options, delay: 20 }, // (api)
      ]);
      try {
        const runner = new Runner(project, 2);
        const execution$ = runner.runCommand(options);
        await expectObservable(Date.now(), execution$, '0-33-1783-1-555-3-1-555-33-11-5-3-1', {}, undefined, 500);
      } catch (e) {
        expect(e).toBeFalsy();
      }
    });
    it('should handle correctly interruption in current step (processed node) - [topological]', async () => {
      stubs.targets?.returns(resolveAfter([
        [
          { workspace: project.workspaces.get('@org/workspace-a')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/workspace-b')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/workspace-c')!, affected: true, hasCommand: true },
        ],
        [
          { workspace: project.workspaces.get('@org/app-a')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-b')!, affected: true, hasCommand: true },
        ],
        [
          { workspace: project.workspaces.get('@org/api')!, affected: true, hasCommand: true },
        ]
      ], 12));
      stubs.watch?.returns(mockSourcesChange([
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
        { resolve: true, options, delay: 200 }, // (w-a)
        { resolve: true, options, delay: 200 }, // (w-b)
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
        await expectObservable(Date.now(), execution$, '0-33-113-7-1-555-3-1-555-33-11-5-3-1', {}, undefined, 500);
      } catch (e) {
        expect(e).toBeFalsy();
      }
    });
    it('should handle correctly interruption in current step (queued node) - [topological]', async () => {
      stubs.targets?.returns(resolveAfter([
        [
          { workspace: project.workspaces.get('@org/workspace-a')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/workspace-b')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/workspace-c')!, affected: true, hasCommand: true },
        ],
        [
          { workspace: project.workspaces.get('@org/app-a')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-b')!, affected: true, hasCommand: true },
        ],
        [
          { workspace: project.workspaces.get('@org/api')!, affected: true, hasCommand: true },
        ]
      ], 12));
      stubs.watch?.returns(mockSourcesChange([
        { workspaceNames: ['@org/workspace-c'], delay: 100},
      ]));
      stubRun(stubs.run, [
        // Schedule 1
        { resolve: true, options: { cmd: 'build', mode: 'topological', force: false, args: [], env: {}, watch: true, debounce: 8 }, delay: 200 }, // (w-a)
        { resolve: true, options: { cmd: 'build', mode: 'topological', force: false, args: [], env: {}, watch: true, debounce: 8 }, delay: 200 }, // (w-b)
        { resolve: true, options: { cmd: 'build', mode: 'topological', force: false, args: [], env: {}, watch: true, debounce: 8 }, delay: 300 }, // (w-c) // +200ms
        { resolve: true, options: { cmd: 'build', mode: 'topological', force: false, args: [], env: {}, watch: true, debounce: 8 }, delay: 100 }, // (app-a)
        { resolve: true, options: { cmd: 'build', mode: 'topological', force: false, args: [], env: {}, watch: true, debounce: 8 }, delay: 100 }, // app-b)
        { resolve: true, options: { cmd: 'build', mode: 'topological', force: false, args: [], env: {}, watch: true, debounce: 8 }, delay: 100 }, // (api)
      ]);
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
        await expectObservable(Date.now(), execution$, '0-33-7-1131-555-33-11-5-3-1', {}, undefined, 500);
      } catch (e) {
        expect(e).toBeFalsy();
      }
    });
    it('should handle correctly multiple interruption complex scenario - [topological]', async () => {
      stubs.targets?.returns(resolveAfter([
        [
          { workspace: project.workspaces.get('@org/workspace-a')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/workspace-b')!, affected: true, hasCommand: false },
          { workspace: project.workspaces.get('@org/workspace-c')!, affected: false, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-a')!, affected: false, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-b')!, affected: true, hasCommand: false },
          { workspace: project.workspaces.get('@org/api')!, affected: true, hasCommand: true },
        ]
      ], 12));
      const options: RunOptions = {
        cmd: 'lint',
        mode: 'parallel',
        force: false,
      }
      stubRun(stubs.run, [
        { resolve: true, options, delay: 14 },
        { resolve: true, options, delay: 23 },
      ])
      try {
        const runner = new Runner(project, 4);
        const execution$ = runner.runCommand(options);
        await expectObservable(Date.now(), execution$, '0-444433-11', {
          1: ['@org/workspace-a', '@org/api'],
          2: [],
          4: ['@org/workspace-c', '@org/workspace-b', '@org/app-a', '@org/app-b'],
          3: ['@org/workspace-a', '@org/api'],
        });
      } catch (e) {
        expect(e).toBeFalsy();
      }
    });
    it.todo('should handle correctly add node event - [topological]');
    it.todo('should start watching sources of added node - [topological]');
    it.todo('should handle correctly remove node event - [topological]');
    it.todo('should stop watching sources of removed node - [topological]');
  });
});
