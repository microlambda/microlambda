import { join, resolve } from "path";
import { Workspace, Cache, ICommandResult, IDaemonCommandResult } from "../src";
import { SinonStub, stub } from "sinon";

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
        foo: {
          cmd: `node ${mockedProcesses.succeed}`,
        },
      });
      stubs.cacheRead.resolves(null);
      stubs.cacheWrite.resolves();
      workspace.run('foo').subscribe((result) => {
        expect(result.overall).toBeGreaterThan(0);
        expect(result.fromCache).toBe(false);
        expect((result.commands[0] as ICommandResult).stdout).toBe('Hello world')
      }, (e) => {
        expect(e).toBeFalsy();
      }, () => done());
    });
    it('should run a given target and emit process result - from cache', (done) => {
      const workspace = new Workspace({} as any, '', {
        foo: {
          cmd: `node ${mockedProcesses.succeed}`,
        },
      });
      stubs.cacheRead.resolves([{ stdout: 'Hello world' }]);
      stubs.cacheWrite.resolves();
      workspace.run('foo').subscribe((result) => {
        expect(result.overall).toBeGreaterThan(0);
        expect(result.fromCache).toBe(true);
        expect((result.commands[0] as ICommandResult).stdout).toBe('Hello world')
      }, (e) => {
        expect(e).toBeFalsy();
      }, () => done());
    });
    it('should run a given target and emit process result - cache read fails', (done) => {
      const workspace = new Workspace({} as any, '', {
        foo: {
          cmd: `node ${mockedProcesses.succeed}`,
        },
      });
      stubs.cacheRead.rejects();
      stubs.cacheWrite.resolves();
      workspace.run('foo').subscribe((result) => {
        expect(result.overall).toBeGreaterThan(0);
        expect(result.fromCache).toBe(false);
        expect((result.commands[0] as ICommandResult).stdout).toBe('Hello world')
      }, (e) => {
        expect(e).toBeFalsy();
      }, () => done());
    });
    it('should run a given target and emit process result - cache write fails', (done) => {
      const workspace = new Workspace({} as any, '', {
        foo: {
          cmd: `node ${mockedProcesses.succeed}`,
        },
      });
      stubs.cacheRead.resolves(null);
      stubs.cacheWrite.rejects();
      workspace.run('foo').subscribe((result) => {
        expect(result.overall).toBeGreaterThan(0);
        expect(result.fromCache).toBe(false);
        expect((result.commands[0] as ICommandResult).stdout).toBe('Hello world')
      }, (e) => {
        expect(e).toBeFalsy();
      }, () => done());
    });
    it('should run a given target and emit error', (done) => {
      const workspace = new Workspace({} as any, '', {
        foo: {
          cmd: `node ${mockedProcesses.failed}`,
        },
      });
      stubs.cacheRead.resolves(null);
      stubs.cacheInvalidate.resolves();
      workspace.run('foo').subscribe((result) => {
        expect(result).toBeFalsy();
      }, (e) => {
        expect(e.stderr).toBe('Boom');
        done();
      }, () => done());
    });
    it('should run a given target and emit error - cache invalidate fails', (done) => {
      const workspace = new Workspace({} as any, '', {
        foo: {
          cmd: `node ${mockedProcesses.failed}`,
        },
      });
      stubs.cacheRead.resolves(null);
      stubs.cacheInvalidate.rejects();
      workspace.run('foo').subscribe((result) => {
        expect(result).toBeFalsy();
      }, (e) => {
        expect(e.stderr).toBe('Boom');
        done();
      }, () => done());
    });
    it('should run a given daemon and emit success', (done) => {
      const workspace = new Workspace({} as any, '', {
        foo: {
          cmd: {
            run: `node ${mockedDaemons.succeed}`,
            daemon: {
              type: 'success',
              stdio: 'stdout',
              matcher: 'contains',
              value: 'up and running',
              timeout: 1000,
            }
          },
        },
      });
      stubs.cacheRead.resolves(null);
      stubs.cacheWrite.resolves();
      workspace.run('foo').subscribe((result) => {
        expect((result.commands[0] as IDaemonCommandResult).process).toBeTruthy();
        (result.commands[0] as IDaemonCommandResult).process.kill();
      }, (e) => {
        expect(e).toBeFalsy();
        done();
      }, () => done());
    });
    it('should run a given daemon and report error - logs condition', (done) => {
      const workspace = new Workspace({} as any, '', {
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
            }]
          },
        },
      });
      stubs.cacheRead.resolves(null);
      stubs.cacheWrite.resolves();
      workspace.run('foo').subscribe((result) => {
        expect(result).toBeFalsy();
      }, (e) => {
        expect(e).toBe("Log condition explicitly failed : {\"type\":\"failure\",\"stdio\":\"stderr\",\"matcher\":\"contains\",\"value\":\"wrong happened\",\"timeout\":1000}");
        done();
      });
    });
    it('should run a given daemon and report error - timeout exceeded', (done) => {
      const workspace = new Workspace({} as any, '', {
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
            }]
          },
        },
      });
      stubs.cacheRead.resolves(null);
      stubs.cacheWrite.resolves();
      workspace.run('foo').subscribe((result) => {
        expect(result).toBeFalsy();
      }, (e) => {
        expect(e).toBe('Timeout (10ms) for log condition exceeded');
        done();
      });
    });
    it('should run a given daemon and report error - crash', (done) => {
      const workspace = new Workspace({} as any, '', {
        foo: {
          cmd: {
            run: `node ${mockedDaemons.crashed}`,
            daemon: [{
              type: 'success',
              stdio: 'stdout',
              matcher: 'contains',
              value: 'up and running',
              timeout: 1000,
            }]
          },
        },
      });
      stubs.cacheRead.resolves(null);
      stubs.cacheWrite.resolves();
      workspace.run('foo').subscribe((result) => {
        expect(result).toBeFalsy();
      }, (e) => {
        expect(e.exitCode).toBe(1);
        done();
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
});
