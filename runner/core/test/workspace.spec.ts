import { join, resolve } from "path";
import { Workspace, Cache, ICommandResult, IDaemonCommandResult } from "../src";
import { SinonStub, stub } from "sinon";
import {Observable} from "rxjs";
import {IProcessResult} from "../src";

const mockedProcesses = {
  succeed: resolve(join(__dirname, 'mocks', 'process', 'success-process.js')),
  failed: resolve(join(__dirname, 'mocks', 'process', 'failed-process.js')),
}

const mockedDaemons = {
  succeed: resolve(join(__dirname, 'mocks', 'process', 'success-daemon.js')),
  failed: resolve(join(__dirname, 'mocks', 'process', 'failed-daemon.js')),
  crashed: resolve(join(__dirname, 'mocks', 'process', 'crashed-daemon.js')),
}

describe('[class] workspace', () => {
  describe('[static method] loadWorkspace', () => {
    it.todo('should be tested');
  });
  describe('[generator] dependencies', () => {
    it.todo('should be tested');
  });
  describe('[generator] dependents', () => {
    it.todo('should be tested');
  });
  describe('[method] isAffected', () => {
    it.todo('should be tested');
  });
  describe('[method] hasCommand', () => {
    it.todo('should be tested');
  });
  describe('[method] run', () => {
    const stubs: { [key: string]: SinonStub } = {};
    beforeEach(() => {
      stubs.cacheRead = stub(Cache.prototype, 'read');
      stubs.cacheWrite = stub(Cache.prototype, 'write');
      stubs.cacheInvalidate = stub(Cache.prototype, 'invalidate');
    });
    afterEach(() => Object.values(stubs).forEach((s) => s.restore()));
    it('should run a given target and emit process result', (done) => {
      const workspace = new Workspace({} as any, '', {
        targets: {
          foo: {
            cmd: `node ${mockedProcesses.succeed}`,
          },
        },
      });
      stubs.cacheRead.resolves(null);
      stubs.cacheWrite.resolves();
      workspace.run({ cmd: 'foo', mode: 'topological' }).subscribe({
        next: (result) => {
          expect(result.overall).toBeGreaterThan(200);
          expect(result.fromCache).toBe(false);
          expect((result.commands[0] as ICommandResult).stdout).toBe('Hello world')
        },
        error: (e) => {
          expect(e).toBeFalsy();
        },
        complete: () => done(),
      });
    });
    it('should run a given target and emit process result - from cache', (done) => {
      const workspace = new Workspace({} as any, '', {
        targets: {
          foo: {
            cmd: `node ${mockedProcesses.succeed}`,
          },
        },
      });
      stubs.cacheRead.resolves([{ stdout: 'Hello world' }]);
      stubs.cacheWrite.resolves();
      workspace.run({ cmd: 'foo', mode: 'topological' }).subscribe({
        next: (result) => {
          expect(result.fromCache).toBe(true);
          expect((result.commands[0] as ICommandResult).stdout).toBe('Hello world')
        },
        error: (e) => {
          expect(e).toBeFalsy();
        },
        complete: () => done()
      });
    });
    it('should run a given target and emit process result - cache read fails', (done) => {
      const workspace = new Workspace({} as any, '', {
        targets: {
          foo: {
            cmd: `node ${mockedProcesses.succeed}`,
          },
        },
      });
      stubs.cacheRead.rejects();
      stubs.cacheWrite.resolves();
      workspace.run({ cmd: 'foo', mode: 'topological' }).subscribe({
        next: (result) => {
          expect(result.overall).toBeGreaterThan(200);
          expect(result.fromCache).toBe(false);
          expect((result.commands[0] as ICommandResult).stdout).toBe('Hello world')
        },
        error: (e) => {
          expect(e).toBeFalsy();
        },
        complete: () => done()
      });
    });
    it('should run a given target and emit process result - cache write fails', (done) => {
      const workspace = new Workspace({} as any, '', {
        targets: {
          foo: {
            cmd: `node ${mockedProcesses.succeed}`,
          },
        },
      });
      stubs.cacheRead.resolves(null);
      stubs.cacheWrite.rejects();
      workspace.run({ cmd: 'foo', mode: 'topological' }).subscribe({
        next: (result) => {
          expect(result.overall).toBeGreaterThan(200);
          expect(result.fromCache).toBe(false);
          expect((result.commands[0] as ICommandResult).stdout).toBe('Hello world')
        },
        error: (e) => {
          expect(e).toBeFalsy();
        },
        complete: () => done()
      });
    });
    it('should run a given target and emit error', (done) => {
      const workspace = new Workspace({} as any, '', {
        targets: {
          foo: {
            cmd: `node ${mockedProcesses.failed}`,
          },
        },
      });
      stubs.cacheRead.resolves(null);
      stubs.cacheInvalidate.resolves();
      workspace.run({ cmd: 'foo', mode: 'topological' }).subscribe((result) => {
        expect(result).toBeFalsy();
      }, (e) => {
        expect(e.stderr).toBe('Boom');
        done();
      }, () => done());
    });
    it('should run a given target and emit error - cache invalidate fails', (done) => {
      const workspace = new Workspace({} as any, '', {
        targets: {
          foo: {
            cmd: `node ${mockedProcesses.failed}`,
          },
        },
      });
      stubs.cacheRead.resolves(null);
      stubs.cacheInvalidate.rejects();
      workspace.run({ cmd: 'foo', mode: 'topological' }).subscribe((result) => {
        expect(result).toBeFalsy();
      }, (e) => {
        expect(e.stderr).toBe('Boom');
        done();
      }, () => done());
    });
    it('should run a given daemon and emit success', (done) => {
      const workspace = new Workspace({} as any, '', {
        targets: {
          foo: {
            cmd: {
              run: `node ${mockedDaemons.succeed}`,
              daemon: {
                type: 'success',
                stdio: 'stdout',
                matcher: 'contains',
                value: 'up and running',
                timeout: 1000,
              },
            },
          },
        }
      });
      stubs.cacheRead.resolves(null);
      stubs.cacheWrite.resolves();
      workspace.run({ cmd: 'foo', mode: 'topological' }).subscribe((result) => {
        expect((result.commands[0] as IDaemonCommandResult).process).toBeTruthy();
        (result.commands[0] as IDaemonCommandResult).process.kill();
      }, (e) => {
        expect(e).toBeFalsy();
        done();
      }, () => done());
    });
    it('should run a given daemon and report error - logs condition', (done) => {
      const workspace = new Workspace({} as any, '', {
        targets: {
          foo: {
            cmd: {
              run: `node ${mockedDaemons.failed}`,
              daemon: [{
                type: 'success',
                stdio: 'stdout',
                matcher: 'contains',
                value: 'up and running',
              }, {
                type: 'failure',
                stdio: 'stderr',
                matcher: 'contains',
                value: 'wrong happened',
                timeout: 1000,
              }],
            },
          },
        }
      });
      stubs.cacheRead.resolves(null);
      stubs.cacheWrite.resolves();
      workspace.run({ cmd: 'foo', mode: 'topological' }).subscribe((result) => {
        expect(result).toBeFalsy();
      }, (e) => {
        expect(e).toBe("Log condition explicitly failed : {\"type\":\"failure\",\"stdio\":\"stderr\",\"matcher\":\"contains\",\"value\":\"wrong happened\",\"timeout\":1000}");
        done();
      });
    });
    it('should run a given daemon and report error - timeout exceeded', (done) => {
      const workspace = new Workspace({} as any, '', {
        targets: {
          foo: {
            cmd: {
              run: `node ${mockedDaemons.succeed}`,
              daemon: [{
                type: 'success',
                stdio: 'stdout',
                matcher: 'contains',
                value: 'up and running',
                timeout: 10,
              }, {
                type: 'failure',
                stdio: 'stderr',
                matcher: 'contains',
                value: 'wrong happened',
                timeout: 1000,
              }],
            },
          },
        }
      });
      stubs.cacheRead.resolves(null);
      stubs.cacheWrite.resolves();
      workspace.run({ cmd: 'foo', mode: 'topological' }).subscribe((result) => {
        expect(result).toBeFalsy();
      }, (e) => {
        expect(e).toBe('Timeout (10ms) for log condition exceeded');
        done();
      });
    });
    it('should run a given daemon and report error - crash', (done) => {
      const workspace = new Workspace({} as any, '', {
        targets: {
          foo: {
            cmd: {
              run: `node ${mockedDaemons.crashed}`,
              daemon: [{
                type: 'success',
                stdio: 'stdout',
                matcher: 'contains',
                value: 'up and running',
                timeout: 1000,
              }],
            },
          },
        }
      });
      stubs.cacheRead.resolves(null);
      stubs.cacheWrite.resolves();
      workspace.run({ cmd: 'foo', mode: 'topological' }).subscribe((result) => {
        expect(result).toBeFalsy();
      }, (e) => {
        expect(e.exitCode).toBe(1);
        done();
      });
    });
    it('should complete without emitting node processed event when killed', (done) => {
      const workspace = new Workspace({} as any, '', {
        targets: {
          foo: {
            cmd: `node ${mockedProcesses.succeed}`,
          },
        },
      });
      stubs.cacheRead.resolves(null);
      stubs.cacheWrite.resolves();
      // cmd foo succeeds in 200ms, we kill process in 50ms (before)
      setTimeout(() => {
        workspace.kill({ cmd: 'foo'})
      }, 50);
      workspace.run({ cmd: 'foo', mode: 'topological' }).subscribe({
        next: (evt) => {
          expect(evt).toBeFalsy();
        },
        error: (e) => { expect(e).toBeFalsy() },
        complete: () => {
          done();
        }
      });
    });
    it('should return already running process if calling command and an execution is already running', (done) => {
      const workspace = new Workspace({} as any, '', {
        targets: {
          foo: {
            cmd: `node ${mockedProcesses.succeed}`,
          },
        },
      });
      stubs.cacheRead.resolves(null);
      stubs.cacheWrite.resolves();
      let obs1: Observable<IProcessResult>;
        let obs2:  Observable<IProcessResult>;
      setTimeout(() => {
        const fooProcesses = workspace.processes.get('foo');
        if (!fooProcesses) {
          throw new Error('Assertion failed: processes not registered');
        }
        expect(fooProcesses.size).toBe(1);
        const pid1 = [...fooProcesses.values()].map((cp) => cp.pid);
        obs2 = workspace.run({ cmd: 'foo', mode: 'topological' });
        expect(obs1).toBe(obs2);
        expect(workspace.processes.size).toBe(1);
        const pid2 = [...fooProcesses.values()].map((cp) => cp.pid);
        expect(pid1).toEqual(pid2);
        let evts: IProcessResult[] = [];
        obs2.subscribe({
          next: (evt) => {
            evts.push(evt);
          },
          error: (e) => { expect(e).toBeFalsy() },
          complete: () => {
            expect(evts).toHaveLength(1);
            done();
          }
        });
      }, 50);
      workspace.run({ cmd: 'foo', mode: 'topological' });
      obs1 = workspace.run({ cmd: 'foo', mode: 'topological' });
      obs1.subscribe();
    });
    it('should re-run process after first execution is done', (done) => {
      const workspace = new Workspace({} as any, '', {
        targets: {
          foo: {
            cmd: `node ${mockedProcesses.succeed}`,
          },
        },
      });
      stubs.cacheRead.resolves(null);
      stubs.cacheWrite.resolves();
      let obs1: Observable<IProcessResult>;
      let obs2:  Observable<IProcessResult>;
      let pid1: (number | undefined)[];
      let evts: IProcessResult[] = [];
      setTimeout(() => {
        pid1 = [...workspace.processes.get('foo')?.values() ?? []].map((cp) => cp.pid);
      }, 50);
      setTimeout(() => {
        const fooProcesses = workspace.processes.get('foo');
        if (!fooProcesses) {
          throw new Error('Assertion failed: processes not registered');
        }
        expect(fooProcesses.size).toBe(0);
        obs2 = workspace.run({ cmd: 'foo', mode: 'topological' });
        expect(obs1 === obs2).toBe(false);
        setTimeout(() => {
          expect(workspace.processes.size).toBe(1);
          const pid2 = [...workspace.processes.get('foo')?.values() ?? []].map((cp) => cp.pid);
          expect(pid1.length === 1 && pid2.length === 1 && pid2[0] !== pid1[0]).toBe(true);
        }, 50);
        obs2.subscribe({
          next: (evt) => {
            evts.push(evt);
          },
          error: (e) => { expect(e).toBeFalsy() },
          complete: () => {
            expect(evts).toHaveLength(2);
            done();
          }
        });
      }, 350);
      workspace.run({ cmd: 'foo', mode: 'topological' });
      obs1 = workspace.run({ cmd: 'foo', mode: 'topological' });
      obs1.subscribe({
        next: (evt) => {
          evts.push(evt);
        },
        error: (e) => { expect(e).toBeFalsy() },
      });
    });
  });
  describe('[method] invalidate', () => {
    it.todo('should be tested');
  });
  describe('[method] bumpVersions', () => {
    it.todo('should be tested');
  });
  describe('[method] publish', () => {
    it.todo('should be tested');
  });
  describe('[method] getNpmInfos', () => {
    it.todo('should be tested');
  });
  describe('[method] isPublished', () => {
    it.todo('should be tested');
  });
  describe('[method] listGreaterVersionsInRegistry', () => {
    it.todo('should be tested');
  });
  describe('[method] setVersion', () => {
    it.todo('should be tested');
  });
  describe('[method] getLastReleaseOnRegistry', () => {
    it.todo('should be tested');
  });
  describe('[method] getLastReleaseTag', () => {
    it.todo('should be tested');
  });
  // TODO: Important
  describe('[method] kill', () => {
    it.todo('should resolves if no running process');
    it.todo('should kill the whole process tree with SIGTERM');
    it.todo('should kill the whole process tree with SIGKILL if ports no release without timeout');
  });
});
