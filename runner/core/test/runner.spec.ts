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
          { resolve: true, killed: 150, delay: 200 },
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
          400,
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
      ], 10));
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
        { workspaceNames: ['@org/api'], delay: 65},
        { workspaceNames: ['@org/workspace-a', '@org/workspace-c'], delay: 130},
        // During first recompile
        { workspaceNames: ['@org/api', '@org/workspace-b'], delay: 350},
        { workspaceNames: ['@org/workspace-c'], delay: 400},
        // After first recompile
        { workspaceNames: ['@org/app-a', '@org/workspace-a', '@org/workspace-c'], delay: 600},
        { workspaceNames: ['@org/app-b'], delay: 650},
      ]));

      stubKill(stubs.kill, new Map([
        ['@org/workspace-a', [{ cmd: 'lint', delay: 10 }, { cmd: 'lint', delay:20 }]],
        ['@org/app-a', [{ cmd: 'lint', delay: 12 }]],
        ['@org/app-b', [{ cmd: 'lint', delay: 200 }]],
        ['@org/api', [{ cmd: 'lint', delay: 21 }, { cmd: 'lint', delay: 22 }]],
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
            {type: RunCommandEventEnum.TARGETS_RESOLVED}, // +12ms
          ],
          [
            {type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-a'}, // +12ms (-> killed)
            {type: RunCommandEventEnum.NODE_SKIPPED, workspace: '@org/workspace-b'}, // +12ms
            {type: RunCommandEventEnum.NODE_SKIPPED, workspace: '@org/workspace-c'}, // +12ms
            {type: RunCommandEventEnum.NODE_SKIPPED, workspace: '@org/app-a'}, // +12ms
            {type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-b'}, // +12ms(-> + 260ms)
            {type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/api'}, // +12ms (-> killed)
          ],
          [
            {type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/api'}, // +65ms
          ],
          [
            {type: RunCommandEventEnum.NODE_INTERRUPTED, workspace: '@org/api'}, // +85ms
          ],
          [
            {type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/api'}, // +87ms (-> killed)
          ],
          [
            {type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/workspace-a'}, // +130ms
            {type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/workspace-c'}, // +130ms
          ],
          [
            {type: RunCommandEventEnum.NODE_INTERRUPTED, workspace: '@org/workspace-a'}, // +145ms
          ],
          [
            {type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-a'}, // +146ms (-> +366ms)
          ],
          [
            {type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-b'}, // +250ms
          ],
          [
            {type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/api'}, // +350ms
            {type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/workspace-b'}, // +350ms
            {type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-a'}, // +366ms (<- + 146ms)
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
            {type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-a'},
          ],
          [
            {type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/app-b'},
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
      stubs.targets?.returns(resolveAfter([
        [
          { workspace: project.workspaces.get('@org/workspace-a')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/workspace-b')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/workspace-c')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-a')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-b')!, affected: true, hasCommand: false },
          { workspace: project.workspaces.get('@org/api')!, affected: false, hasCommand: true },
        ]
      ], 10));
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
      /*stubRun(stubs.run, [
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
      ]);*/
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
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-a'}, // +600ms
          ],
          [
            { type: RunCommandEventEnum.NODE_ERRORED, workspace: '@org/app-a'}, // +700ms
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/app-a'}, // +710ms
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
        ], 200);
      } catch (e) {
        expect(e).toBeFalsy();
      }
    });
    it('should handle multiple file changes within a step execution - [parallel]', async () => {
      stubs.targets?.returns(resolveAfter([
        [
          { workspace: project.workspaces.get('@org/workspace-a')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/workspace-b')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/workspace-c')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-a')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-b')!, affected: true, hasCommand: false },
          { workspace: project.workspaces.get('@org/api')!, affected: false, hasCommand: true },
        ]
      ], 8));
      stubs.watch?.returns(mockSourcesChange([
        { workspaceNames: ['@org/workspace-a'], delay: 70},
        { workspaceNames: ['@org/app-a'], delay: 100},
        { workspaceNames: ['@org/app-a', '@org/workspace-b'], delay: 150},
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
          { cmd: 'lint', delay: 25 },
        ]],
        ['@org/app-a', [
          { cmd: 'lint', delay: 20 },
          { cmd: 'lint', delay: 15 },
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
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-a' }, // + 70ms
          ],
          [
            { type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/app-a'}, // +100ms
          ],
          [
            { type: RunCommandEventEnum.NODE_INTERRUPTED, workspace: '@org/app-a'}, // +125ms
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
            { type: RunCommandEventEnum.NODE_INTERRUPTED, workspace: '@org/workspace-b'}, // +175ms
            { type: RunCommandEventEnum.NODE_INTERRUPTED, workspace: '@org/app-a'}, // +170ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-a' },  // +170ms (-> 320ms)
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
        ['@org/app-a', [{cmd: 'start', delay: 11} ]],
        ['@org/api', [{cmd: 'start', delay: 8}, {cmd: 'start', delay: 23} ]],
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
          { resolve: false, error: new Error('Bam!') },
          { resolve: true, delay: 42 },
        ]],
      ]));

      stubs.watch?.returns(mockSourcesChange([
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
            { type: RunCommandEventEnum.NODE_ERRORED, workspace: '@org/api' },
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/api' },
          ],
          [
            { type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/workspace-a' },
            { type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/workspace-c' },
            { type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/api' },
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
    it('should restart daemon when starting and files change - [parallel]', async () => {
      stubs.targets?.returns(resolveAfter([
        [
          { workspace: project.workspaces.get('@org/workspace-a')!, affected: false, hasCommand: false },
          { workspace: project.workspaces.get('@org/workspace-b')!, affected: false, hasCommand: false },
          { workspace: project.workspaces.get('@org/workspace-c')!, affected: false, hasCommand: false },
          { workspace: project.workspaces.get('@org/app-a')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-b')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/api')!, affected: true, hasCommand: true },
        ]
      ], 12));

      stubKill(stubs.kill, new Map([
        ['@org/app-a', [{cmd: 'start', delay: 150} ]],
        ['@org/api', [{cmd: 'start', delay: 200} ]],
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
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-b' }, // +230ms
            { type: RunCommandEventEnum.NODE_INTERRUPTED, workspace: '@org/app-a' },  // +260ms
            { type: RunCommandEventEnum.NODE_INTERRUPTED, workspace: '@org/api' }, // +310ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-a' }, // +320ms
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/api' }, // +320ms
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

      stubs.targets?.withArgs('start', options).returns(resolveAfter([
        [
          { workspace: project.workspaces.get('@org/app-a')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-b')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/api')!, affected: true, hasCommand: true },
        ]
      ], 20));

      stubs.watch?.returns(mockSourcesChange([]));

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
          runner.addWorkspaces([ project.workspaces.get('@org/api')!]);
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
          { workspace: project.workspaces.get('@org/app-a')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-b')!, affected: true, hasCommand: true },
        ]
      ], 20));
      stubs.targets?.withArgs('start', { ...options, workspaces: secondScope }).returns(resolveAfter([
        [
          { workspace: project.workspaces.get('@org/app-a')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-b')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/api')!, affected: true, hasCommand: true },
        ]
      ], 20));

      stubs.watch?.returns(mockSourcesChange([]));

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
          runner.addWorkspaces([ project.workspaces.get('@org/api')!]);
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
          { workspace: project.workspaces.get('@org/app-a')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-b')!, affected: true, hasCommand: true },
        ]
      ], 20));
      stubs.targets?.withArgs('start', { ...options, workspaces: secondScope }).returns(resolveAfter([
        [
          { workspace: project.workspaces.get('@org/app-a')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-b')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/api')!, affected: true, hasCommand: true },
        ]
      ], 20));

      stubs.watch?.returns(mockSourcesChange([]));

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
          runner.addWorkspaces([ project.workspaces.get('@org/api')!]);
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
          { workspace: project.workspaces.get('@org/app-a')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-b')!, affected: true, hasCommand: true },
        ]
      ], 20));
      stubs.targets?.withArgs('start', { ...options, workspaces: secondScope }).returns(resolveAfter([
        [
          { workspace: project.workspaces.get('@org/app-a')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-b')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/api')!, affected: true, hasCommand: true },
        ]
      ], 20));

      stubs.watch?.returns(mockSourcesChange([
        { workspaceNames: ['@org/app-b', '@org/api'], delay: 350},
      ]));

      stubKill(stubs.kill, new Map([
        ['@org/app-b', [{cmd: 'start', delay: 12} ]],
        ['@org/api', [{cmd: 'start', delay: 24} ]],
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
          runner.addWorkspaces([ project.workspaces.get('@org/api')!]);
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
            { type: RunCommandEventEnum.NODE_INTERRUPTED, workspace: '@org/api' },
            { type: RunCommandEventEnum.NODE_INTERRUPTED, workspace: '@org/app-b' },
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/api' },
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-b' },
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
          { workspace: project.workspaces.get('@org/app-a')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-b')!, affected: true, hasCommand: true },
        ]
      ], 20));

      stubs.watch?.returns(mockSourcesChange([]));

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
          runner.removeWorkspace([ project.workspaces.get('@org/api')!]);
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
          { workspace: project.workspaces.get('@org/app-a')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-b')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/api')!, affected: true, hasCommand: true },
        ]
      ], 20));

      stubs.targets?.withArgs('start', {...options, workspaces: secondScope}).returns(resolveAfter([
        [
          { workspace: project.workspaces.get('@org/app-a')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-b')!, affected: true, hasCommand: true },
        ]
      ], 20));

      stubs.targets?.withArgs('start', {...options, workspaces: thirdScope}).returns(resolveAfter([
        [
          { workspace: project.workspaces.get('@org/app-a')!, affected: true, hasCommand: true },
        ]
      ], 20));

      stubs.watch?.returns(mockSourcesChange([]));

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
          { cmd: 'start', delay: 20 },
        ]],
        ['@org/api', [
          { cmd: 'start', delay: 20 },
        ]],
      ]));

      try {
        const runner = new Runner(project, 8);
        const execution$ = runner.runCommand(options);
        setTimeout(() => {
          runner.removeWorkspace([ project.workspaces.get('@org/api')!]);
          console.debug('100ms');
        }, 100);
        setTimeout(() => {
          console.debug('300ms');
          runner.removeWorkspace([ project.workspaces.get('@org/app-b')!]);
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
          { workspace: project.workspaces.get('@org/app-a')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-b')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/api')!, affected: true, hasCommand: true },
        ]
      ], 20));

      stubs.targets?.withArgs('lint', {...options, workspaces: secondScope}).returns(resolveAfter([
        [
          { workspace: project.workspaces.get('@org/app-a')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-b')!, affected: true, hasCommand: true },
        ]
      ], 20));

      stubs.targets?.withArgs('lint', {...options, workspaces: thirdScope}).returns(resolveAfter([
        [
          { workspace: project.workspaces.get('@org/app-a')!, affected: true, hasCommand: true },
        ]
      ], 20));

      stubs.watch?.returns(mockSourcesChange([]));

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
          { cmd: 'lint', delay: 20 },
        ]],
      ]));

      try {
        const runner = new Runner(project, 8);
        const execution$ = runner.runCommand(options);
        setTimeout(() => {
          runner.removeWorkspace([ project.workspaces.get('@org/api')!]);
          console.debug('100ms');
        }, 100);
        setTimeout(() => {
          console.debug('300ms');
          runner.removeWorkspace([ project.workspaces.get('@org/app-b')!]);
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

      stubs.targets?.withArgs('start', options).returns(resolveAfter([
        [
          { workspace: project.workspaces.get('@org/app-a')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-b')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/api')!, affected: true, hasCommand: true },
        ]
      ], 20));

      stubs.targets?.withArgs('start', {...options, workspaces: secondScope}).returns(resolveAfter([
        [
          { workspace: project.workspaces.get('@org/app-a')!, affected: true, hasCommand: true },
          { workspace: project.workspaces.get('@org/app-b')!, affected: true, hasCommand: true },
        ]
      ], 20));

      stubs.targets?.withArgs('start', {...options, workspaces: thirdScope}).returns(resolveAfter([
        [
          { workspace: project.workspaces.get('@org/app-a')!, affected: true, hasCommand: true },
        ]
      ], 20));

      // should not happen as we have unwatched these workspaces, but we have a security
      stubs.watch?.returns(mockSourcesChange([
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
          { cmd: 'start', delay: 20 },
        ]],
        ['@org/api', [
          { cmd: 'start', delay: 20 },
        ]],
      ]));

      try {
        const runner = new Runner(project, 8);
        const execution$ = runner.runCommand(options);
        setTimeout(() => {
          runner.removeWorkspace([ project.workspaces.get('@org/api')!]);
          console.debug('100ms');
        }, 100);
        setTimeout(() => {
          console.debug('300ms');
          runner.removeWorkspace([ project.workspaces.get('@org/app-b')!]);
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
          scope.map((workspace) => ({ workspace, affected: true, hasCommand: true })),
        ], 20));
      });

      stubs.watch?.onCall(0)?.returns(mockSourcesChange([])); // +0ms
      stubs.watch?.onCall(1)?.returns(mockSourcesChange([])); // +100ms
      stubs.watch?.onCall(2)?.returns(mockSourcesChange([ // +320ms
        { workspaceNames: ['@org/app-a', '@org/app-b'], delay: 350 - 320 },
      ]));
      stubs.watch?.onCall(3)?.returns(mockSourcesChange([ // +570ms
        { workspaceNames: ['@org/app-a', '@org/app-b'], delay: 600 - 570 }
      ]));
      stubs.watch?.onCall(4)?.returns(mockSourcesChange([])); //+ 720ms

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
          { cmd: 'start', delay: 20 },  // +350ms
          { cmd: 'start', delay: 20 },  // +600ms
        ]],
        ['@org/app-b', [
          { cmd: 'start', delay: 20 },  // +350ms
          { cmd: 'start', delay: 20 },  // +550ms
        ]],
        ['@org/api', [
          { cmd: 'start', delay: 20 },  // +100ms
          { cmd: 'start', delay: 20 },  // +550ms
        ]],
      ]));

      try {
        const runner = new Runner(project, 8);
        const execution$ = runner.runCommand(options);
        setTimeout(() => {
          runner.removeWorkspace([ project.workspaces.get('@org/api')!]);
        }, 100);
        setTimeout(() => {
          runner.addWorkspaces([ project.workspaces.get('@org/api')!]);
        }, 300);
        setTimeout(() => {
          runner.removeWorkspace([ project.workspaces.get('@org/app-b')!, project.workspaces.get('@org/api')!]);
        }, 550);
        setTimeout(() => {
          runner.addWorkspaces([ project.workspaces.get('@org/app-b')!, project.workspaces.get('@org/api')!]);
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
            { type: RunCommandEventEnum.NODE_INTERRUPTED, workspace: '@org/app-a' }, // +370ms
            { type: RunCommandEventEnum.NODE_INTERRUPTED, workspace: '@org/app-b' }, // +370ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-a' }, // +380ms
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
            { type: RunCommandEventEnum.NODE_INTERRUPTED, workspace: '@org/api' }, // +570ms
            { type: RunCommandEventEnum.NODE_INTERRUPTED, workspace: '@org/app-b' }, // +570ms
          ],
          [
            { type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/app-a' }, // +600ms
          ],
          [
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
    it.todo('should handle filesystem events while re-computing targets - [parallel]');
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
        ['@org/workspace-a', [{cmd: 'build', delay: 23}, {cmd: 'build', delay: 12}]],
        ['@org/workspace-c', [{cmd: 'build', delay: 15}]],
        ['@org/app-a', [{cmd: 'build', delay: 31}]],
        ['@org/app-b', [{cmd: 'build', delay: 19}]],
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
          { resolve: true, delay: 300 },
          { resolve: true, delay: 200 },
          { resolve: true, delay: 20 },
        ]],
        ['@org/app-a', [
          { resolve: true, delay: 2 },
          { resolve: true, delay: 200 },
          { resolve: true, delay: 20 },
          { resolve: true, delay: 20 },
        ]],
        ['@org/app-b', [
          { resolve: true, delay: 2 },
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
            { type: RunCommandEventEnum.TARGETS_RESOLVED },
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-a' },
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-b' },
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-a' },
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-b' },
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/workspace-c' },
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/app-b' },
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/app-a' },
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/api' },
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-c' },
          ],
          [
            { type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/workspace-a' },
            { type: RunCommandEventEnum.NODE_INTERRUPTED, workspace: '@org/workspace-c' },
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-a' },
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-a' },
          ],
          [
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/workspace-c' },
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/app-b' },
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/app-a' },
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/api' },
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-c' },
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-c' },
          ],
          [
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/app-b' },
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/app-a' },
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/api' },
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-a' },
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-b' },
          ],
          [
            { type: RunCommandEventEnum.SOURCES_CHANGED, workspace: '@org/workspace-a' },
            { type: RunCommandEventEnum.NODE_INTERRUPTED, workspace: '@org/app-a' },
            { type: RunCommandEventEnum.NODE_INTERRUPTED, workspace: '@org/app-b' },
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-a' },
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-a' },
          ],
          [
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/workspace-c' },
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/app-b' },
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/app-a' },
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/api' },
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/workspace-c' },
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-c' },
          ],
          [
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/app-b' },
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/app-a' },
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/api' },
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
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-a' },
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/app-a' },
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
        ], 500)
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
      ], 5));
      stubs.watch?.returns(mockSourcesChange([
        { workspaceNames: ['@org/workspace-b'], delay: 150},
      ]));

      stubKill(stubs.kill, new Map([
        ['@org/workspace-b', [{ cmd: 'build', delay: 10 }]],
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
          ],
          [
            { type: RunCommandEventEnum.NODE_INTERRUPTED, workspace: '@org/workspace-b' }, // +160ms
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/workspace-b' }, // + 160ms
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/app-b' }, // + 160ms
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/app-a' }, // + 160ms
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/api' }, // + 160ms
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
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/app-b' }, // + 500ms
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/app-a' }, // + 500ms
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/api' }, // + 500ms
          ],
          [
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-a' }, // +505ms
            { type: RunCommandEventEnum.NODE_STARTED, workspace: '@org/app-b' }, // +505ms
          ],
          [
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-a' }, // +510ms
            { type: RunCommandEventEnum.NODE_PROCESSED, workspace: '@org/workspace-b' }, // +510ms
          ],
          [
            { type: RunCommandEventEnum.CACHE_INVALIDATED, workspace: '@org/api' }, // +510ms
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
    it.todo('should handle complex scenarios were adding/removing nodes - [topological]');
    it.todo('should handle system events while re-computing targets - [topological]');
  });
});
