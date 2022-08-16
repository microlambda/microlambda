// @ts-ignore
import {Cache} from "../src/cache";
// @ts-ignore
import {CentipodErrorCode, CentipodError, Workspace} from "../src";
import {spy, stub } from "sinon";
import {Checksum} from "../src/checksum";
import { promises as nodeFs } from 'fs';
import { logger } from '../src/logger';
import { F_OK } from 'constants';

describe('[class] Cache manager', () => {
  describe('[method] read()', () => {
    it('should return cached command result if the stored checksum and the current checksum are the same', async () => {
      const workspace = {
        root: '/tmp/fake/location',
        config: {
          foo: {
            src: ['**'],
            cmd: 'npm run foo',
          }
        }
      }
      const cache = new Cache(workspace as unknown as Workspace, 'foo');
      const checksums = {
        calculate: stub(Checksum.prototype, 'calculate'),
        read: stub(Checksum.prototype, 'read'),
      };
      const fs = stub(nodeFs, 'readFile');
      checksums.calculate.resolves({
        args: '[]',
        cmd: 'foo',
        env: '{}',
        globs: 'foo/**/*.ts,bar/**/*;ts',
        'foo/bar.ts:': 'b6a73d8bc3edf20e',
        'foo/baz.ts:': '022cf092d78977',
      });
      checksums.read.resolves({
        args: '[]',
        env: '{}',
        cmd: 'foo',
        globs: 'foo/**/*.ts,bar/**/*;ts',
        'foo/bar.ts:': 'b6a73d8bc3edf20e',
        'foo/baz.ts:': '022cf092d78977',
      });
      fs.rejects();
      fs.withArgs('/tmp/fake/location/.caches/foo/output.json').resolves(Buffer.from(JSON.stringify([{ cmd: 'foo', exitCode: 0, stderr: '', stdout: 'success', all: 'success'}])));
      const output = await cache.read();
      checksums.read.restore();
      checksums.calculate.restore();
      fs.restore();
      expect(output).toEqual([{ cmd: 'foo', exitCode: 0, stderr: '', stdout: 'success', all: 'success'}]);
    });
    it('should return null if the stored checksum and the current checksum are different', async () => {
      const workspace = {
        root: '/tmp/fake/location',
        config: {
          foo: {
            src: ['**'],
            cmd: 'npm run foo',
          }
        }
      }
      const cache = new Cache(workspace as unknown as Workspace, 'foo');
      const checksums = {
        calculate: stub(Checksum.prototype, 'calculate'),
        read: stub(Checksum.prototype, 'read'),
      };
      const fs = stub(nodeFs, 'readFile');
      checksums.calculate.resolves({
        cmd: 'foo',
        globs: 'foo/**/*.ts,bar/**/*;ts',
        'foo/bar.ts:': 'b6a73d8bc3edf20e',
        'foo/baz.ts:': '022cf092d78977',
      });
      checksums.read.resolves({
        cmd: 'foo',
        globs: 'foo/**/*.ts,bar/**/*;ts',
        'foo/bar.ts:': 'b6a73d83edf20e',
        'foo/baz.ts:': '022cf092d78977',
      });
      fs.rejects();
      fs.withArgs('/tmp/fake/location/.caches/foo/output.json').resolves(Buffer.from(JSON.stringify([{ cmd: 'foo', exitCode: 0, stderr: '', stdout: 'success', all: 'success'}])));
      const output = await cache.read();
      checksums.read.restore();
      checksums.calculate.restore();
      fs.restore();
      expect(output).toBe(null);
    });
    it('should return null if something wrong happen reading checksum', async () => {
      const workspace = {
        root: '/tmp/fake/location',
        config: {
          foo: {
            src: ['**'],
            cmd: 'npm run foo',
          }
        }
      }
      const cache = new Cache(workspace as unknown as Workspace, 'foo');
      const checksums = {
        calculate: stub(Checksum.prototype, 'calculate'),
        read: stub(Checksum.prototype, 'read'),
      };
      checksums.calculate.resolves({
        cmd: 'foo',
        globs: 'foo/**/*.ts,bar/**/*;ts',
        'foo/bar.ts:': 'b6a73d8bc3edf20e',
        'foo/baz.ts:': '022cf092d78977',
      });
      checksums.read.rejects('Error happened reading checksums')
      const output = await cache.read();
      checksums.read.restore();
      checksums.calculate.restore();
      expect(output).toBe(null);
    });
    it('should return null if something wrong happen calculating current checksum', async () => {
      const workspace = {
        root: '/tmp/fake/location',
        config: {
          foo: {
            src: ['**'],
            cmd: 'npm run foo',
          }
        }
      }
      const cache = new Cache(workspace as unknown as Workspace, 'foo');
      const checksums = {
        calculate: stub(Checksum.prototype, 'calculate'),
        read: stub(Checksum.prototype, 'read'),
      };
      checksums.calculate.rejects('Error happened calculating checksums')
      checksums.read.resolves({
        cmd: 'foo',
        globs: 'foo/**/*.ts,bar/**/*;ts',
        'foo/bar.ts:': 'b6a73d83edf20e',
        'foo/baz.ts:': '022cf092d78977',
      });
      const output = await cache.read();
      checksums.read.restore();
      checksums.calculate.restore();
      expect(output).toBe(null);
    });
    it('should return null if something wrong happen reading cached command output', async () => {
      const workspace = {
        root: '/tmp/fake/location',
        config: {
          foo: {
            src: ['**'],
            cmd: 'npm run foo',
          }
        }
      }
      const cache = new Cache(workspace as unknown as Workspace, 'foo');
      const checksums = {
        calculate: stub(Checksum.prototype, 'calculate'),
        read: stub(Checksum.prototype, 'read'),
      };
      const fs = stub(nodeFs, 'readFile');
      checksums.calculate.resolves({
        cmd: 'foo',
        globs: 'foo/**/*.ts,bar/**/*;ts',
        'foo/bar.ts:': 'b6a73d8bc3edf20e',
        'foo/baz.ts:': '022cf092d78977',
      });
      checksums.read.resolves({
        cmd: 'foo',
        globs: 'foo/**/*.ts,bar/**/*;ts',
        'foo/bar.ts:': 'b6a73d8bc3edf20e',
        'foo/baz.ts:': '022cf092d78977',
      });
      fs.rejects('Error reading file');
      const output = await cache.read();
      checksums.read.restore();
      checksums.calculate.restore();
      fs.restore();
      expect(output).toEqual(null);
    });
    it('should return null if cached output is not parseable', async () => {
      const workspace = {
        root: '/tmp/fake/location',
        config: {
          foo: {
            src: ['**'],
            cmd: 'npm run foo',
          }
        }
      }
      const cache = new Cache(workspace as unknown as Workspace, 'foo');
      const checksums = {
        calculate: stub(Checksum.prototype, 'calculate'),
        read: stub(Checksum.prototype, 'read'),
      };
      const fs = stub(nodeFs, 'readFile');
      checksums.calculate.resolves({
        cmd: 'foo',
        globs: 'foo/**/*.ts,bar/**/*;ts',
        'foo/bar.ts:': 'b6a73d8bc3edf20e',
        'foo/baz.ts:': '022cf092d78977',
      });
      checksums.read.resolves({
        cmd: 'foo',
        globs: 'foo/**/*.ts,bar/**/*;ts',
        'foo/bar.ts:': 'b6a73d8bc3edf20e',
        'foo/baz.ts:': '022cf092d78977',
      });
      fs.rejects();
      fs.withArgs('/tmp/fake/location/.caches/foo/output.json').resolves(Buffer.from('Not parseable content'));
      const output = await cache.read();
      checksums.read.restore();
      checksums.calculate.restore();
      fs.restore();
      expect(output).toEqual(null);
    });
    it('should return null and warn user if config patterns match no files', async () => {
      const workspace = {
        root: '/tmp/fake/location',
        config: {
          foo: {
            src: ['**'],
            cmd: 'npm run foo',
          }
        }
      }
      const cache = new Cache(workspace as unknown as Workspace, 'foo');
      const checksums = {
        calculate: stub(Checksum.prototype, 'calculate'),
        read: stub(Checksum.prototype, 'read'),
      };
      const log = spy(logger, 'warn');
      checksums.calculate.rejects(new CentipodError(CentipodErrorCode.NO_FILES_TO_CACHE, 'No path to cache'));
      checksums.read.resolves({
        cmd: 'foo',
        globs: 'foo/**/*.ts,bar/**/*;ts',
        'foo/bar.ts:': 'b6a73d83edf20e',
        'foo/baz.ts:': '022cf092d78977',
      });
      const output = await cache.read();
      checksums.read.restore();
      checksums.calculate.restore();
      log.restore();
      expect(output).toBe(null);
      expect(log.called).toBe(true);
    });
  });
  describe('[method] write()', () => {
    it('should create cache directory if not exists', async () => {
      const access = stub(nodeFs, 'access');
      const mkdir = stub(nodeFs, 'mkdir');
      const writeFile = stub(nodeFs, 'writeFile');
      const calculate = stub(Checksum.prototype, 'calculate');
      calculate.resolves({ foo: 'bar' });
      access.rejects();
      writeFile.resolves();
      mkdir.resolves();
      const workspace = {
        root: '/tmp/fake/location',
        config: {
          foo: {
            src: ['**'],
            cmd: 'npm run foo',
          }
        }
      }
      const cache = new Cache(workspace as unknown as Workspace, 'foo');
      await cache.write([]);
      access.restore();
      writeFile.restore();
      mkdir.restore();
      calculate.restore();
      expect(mkdir.callCount).toBe(1);
      expect(mkdir.calledWith('/tmp/fake/location/.caches/foo', { recursive: true }))
    });
    it('should not create cache directory if exists', async () => {
      const access = stub(nodeFs, 'access');
      const mkdir = stub(nodeFs, 'mkdir');
      const writeFile = stub(nodeFs, 'writeFile');
      const calculate = stub(Checksum.prototype, 'calculate');
      calculate.resolves({ foo: 'bar' });
      access.rejects();
      access.withArgs('/tmp/fake/location/.caches/foo', F_OK).resolves();
      writeFile.resolves();
      mkdir.rejects();
      const workspace = {
        root: '/tmp/fake/location',
        config: {
          foo: {
            src: ['**'],
            cmd: 'npm run foo',
          }
        }
      }
      const cache = new Cache(workspace as unknown as Workspace, 'foo');
      await cache.write([]);
      access.restore();
      writeFile.restore();
      mkdir.restore();
      calculate.restore();
      expect(mkdir.callCount).toBe(0);
    });
    it('should use cached checksums if available', async () => {
      const access = stub(nodeFs, 'access');
      const writeFile = stub(nodeFs, 'writeFile');
      const calculate = stub(Checksum.prototype, 'calculate');
      calculate.rejects();
      access.resolves();
      writeFile.resolves();
      const workspace = {
        root: '/tmp/fake/location',
        config: {
          foo: {
            src: ['**'],
            cmd: 'npm run foo',
          }
        }
      }
      const cache = new Cache(workspace as unknown as Workspace, 'foo');
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      cache._checksums = { foo: 'bar '};
      await cache.write([]);
      access.restore();
      writeFile.restore();
      calculate.restore();
      expect(calculate.callCount).toBe(0);
    });
    it('should recalculate checksums if not cached in class memory', async () => {
      const access = stub(nodeFs, 'access');
      const writeFile = stub(nodeFs, 'writeFile');
      const calculate = stub(Checksum.prototype, 'calculate');
      calculate.resolves({ foo: 'bar' });
      access.rejects();
      writeFile.resolves();
      const workspace = {
        root: '/tmp/fake/location',
        config: {
          foo: {
            src: ['**'],
            cmd: 'npm run foo',
          }
        }
      }
      const cache = new Cache(workspace as unknown as Workspace, 'foo');
      await cache.write([]);
      access.restore();
      writeFile.restore();
      calculate.restore();
      expect(calculate.callCount).toBe(1);
    });
    it('should invalidate cache and warn user if something wrong happen', async () => {
      const access = stub(nodeFs, 'access');
      const mkdir = stub(nodeFs, 'mkdir');
      const writeFile = stub(nodeFs, 'writeFile');
      const calculate = stub(Checksum.prototype, 'calculate');
      const invalidate = stub(Cache.prototype, 'invalidate');
      const log = stub(logger, 'warn');
      const workspace = {
        root: '/tmp/fake/location',
        config: {
          foo: {
            src: ['**'],
            cmd: 'npm run foo',
          }
        }
      }
      const cache = new Cache(workspace as unknown as Workspace, 'foo');
      const restore = (): void => {
        access.restore();
        writeFile.restore();
        mkdir.restore();
        calculate.restore();
        invalidate.restore();
        log.restore();
      }
      // cache calculation failed
      try {
        calculate.rejects();
        access.resolves();
        writeFile.resolves();
        mkdir.resolves();
        await cache.write([]);
        restore();
        fail('should throw');
      } catch (e) {
        expect(log.callCount).toBe(1);
        expect(invalidate.callCount).toBe(1);
      }
      // access and mkdir failed
      try {
        calculate.resolves({ foo: 'bar' });
        access.rejects();
        mkdir.rejects();
        writeFile.resolves();
        await cache.write([]);
        restore();
        fail('should throw');
      } catch (e) {
        expect(log.callCount).toBe(1);
        expect(invalidate.callCount).toBe(1);
      }
      // write file failed
      try {
        calculate.resolves({ foo: 'bar' });
        access.resolves();
        writeFile.resolves();
        mkdir.rejects();
        await cache.write([]);
        restore();
        fail('should throw');
      } catch (e) {
        expect(log.callCount).toBe(1);
        expect(invalidate.callCount).toBe(1);
      }
      restore();
    });
  });
  describe('[method] invalidate()', () => {
    it('should remove caches if existing', async () => {
      const access = stub(nodeFs, 'access');
      const unlink = stub(nodeFs, 'unlink');
      access.resolves();
      unlink.resolves();
      const workspace = {
        root: '/tmp/fake/location',
        config: {
          foo: {
            src: ['**'],
            cmd: 'npm run foo',
          }
        }
      }
      const cache = new Cache(workspace as unknown as Workspace, 'foo');
      await cache.invalidate();
      access.restore();
      unlink.restore();
      expect(access.callCount).toBe(2);
      expect(access.calledWith('/tmp/fake/location/.caches/foo/checksums.json', F_OK))
      expect(access.calledWith('/tmp/fake/location/.caches/foo/output.json', F_OK))
      expect(unlink.callCount).toBe(2);
      expect(unlink.calledWith('/tmp/fake/location/.caches/foo/output.json'))
      expect(unlink.calledWith('/tmp/fake/location/.caches/foo/checksums.json'))
    });
    it('should return without doing nothing if cache files do not exists', async () => {
      const access = stub(nodeFs, 'access');
      const unlink = stub(nodeFs, 'unlink');
      access.rejects('Unknown error')
      access.withArgs('/tmp/fake/location/.caches/foo/output.json', F_OK).rejects({ code: 'ENOENT' });
      access.withArgs('/tmp/fake/location/.caches/foo/checksums.json', F_OK).rejects({ code: 'ENOENT' });
      unlink.resolves();
      const workspace = {
        root: '/tmp/fake/location',
        config: {
          foo: {
            src: ['**'],
            cmd: 'npm run foo',
          }
        }
      }
      const cache = new Cache(workspace as unknown as Workspace, 'foo');
      await cache.invalidate();
      access.restore();
      unlink.restore();
      expect(unlink.callCount).toBe(0);
      expect(unlink.calledWith('/tmp/fake/location/.caches/foo/output.json'))
      expect(unlink.calledWith('/tmp/fake/location/.caches/foo/checksums.json'))
    });
    it('should throw a fatal error and warn user if cache existence cannot be determined', async () => {
      const access = stub(nodeFs, 'access');
      const unlink = stub(nodeFs, 'unlink');
      access.rejects('Unknown error')
      unlink.resolves();
      const workspace = {
        root: '/tmp/fake/location',
        config: {
          foo: {
            src: ['**'],
            cmd: 'npm run foo',
          }
        }
      }
      const cache = new Cache(workspace as unknown as Workspace, 'foo');
      try {
        await cache.invalidate();
        access.restore();
        unlink.restore();
        fail('should throw');
      } catch (e) {
        access.restore();
        unlink.restore();
        expect(e instanceof CentipodError).toBe(true);
        expect((e as CentipodError).code).toBe(CentipodErrorCode.INVALIDATING_CACHE_FAILED);
      }
    });
    it('should throw a fatal error and warn user if caches exist but cannot be removed', async () => {
      const access = stub(nodeFs, 'access');
      const unlink = stub(nodeFs, 'unlink');
      access.resolves()
      unlink.resolves();
      unlink.withArgs('/tmp/fake/location/.caches/foo/output.json').rejects();
      const workspace = {
        root: '/tmp/fake/location',
        config: {
          foo: {
            src: ['**'],
            cmd: 'npm run foo',
          }
        }
      }
      const cache = new Cache(workspace as unknown as Workspace, 'foo');
      try {
        await cache.invalidate();
        access.restore();
        unlink.restore();
        fail('should throw');
      } catch (e) {
        access.restore();
        unlink.restore();
        expect(e instanceof CentipodError).toBe(true);
        expect((e as CentipodError).code).toBe(CentipodErrorCode.INVALIDATING_CACHE_FAILED);
      }
    });
  });
});
