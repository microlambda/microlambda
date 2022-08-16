import { stub } from "sinon";
import { promises as fs } from "fs";
// @ts-ignore
import {Cache} from "../src/cache";
import {Checksum} from "../src/checksum";
// @ts-ignore
import {CentipodError, CentipodErrorCode, Workspace} from "../src";
import fastGlob from 'fast-glob';
import hasha from 'hasha';

describe('[class] Checksum manager', () => {
  describe('[method] read', () => {
    it('should return checksums read from filesystem', async () => {
      const workspace = {
        root: '/tmp/fake/location',
      }
      const readFile = stub(fs, 'readFile');
      readFile.rejects();
      readFile.withArgs('/tmp/fake/location/.caches/baz/checksums.json').resolves(Buffer.from(JSON.stringify({ file1: 'a676fd3' })));
      const cache = new Cache(workspace as Workspace, 'baz');
      const checksum = new Checksum(cache);
      const res = await checksum.read();
      readFile.restore();
      expect(res).toEqual({ file1: 'a676fd3' });
    });
    it('should return empty object if read file fails', async () => {
      const workspace = {
        root: '/tmp/fake/location',
      }
      const readFile = stub(fs, 'readFile');
      readFile.rejects();
      const cache = new Cache(workspace as Workspace, 'baz');
      const checksum = new Checksum(cache);
      const res = await checksum.read();
      readFile.restore();
      expect(res).toEqual({});
    });
    it('should return empty object if file content is not parseable json', async () => {
      const workspace = {
        root: '/tmp/fake/location',
      }
      const readFile = stub(fs, 'readFile');
      readFile.rejects();
      readFile.withArgs('/tmp/fake/location/.caches/baz/checksums.json').resolves(Buffer.from('Invalid checksums'));
      const cache = new Cache(workspace as Workspace, 'baz');
      const checksum = new Checksum(cache);
      const res = await checksum.read();
      readFile.restore();
      expect(res).toEqual({});
    });
  })
  describe('[method] calculate', () => {
    it('should compute and store sha256 checksums for the files described by globs array', async () => {
      const workspace = {
        root: '/tmp/fake/location',
        config: {
          foo: {
            cmd: "npm run foo",
            src: [
              "src/**/*.ts",
              "test/**/*.ts",
            ]
          }
        }
      }
      const glob = stub(fastGlob, 'sync');
      glob.returns(['wat']);
      glob.withArgs('/tmp/fake/location/src/**/*.ts').returns([
        '/tmp/fake/location/src/index.ts',
        '/tmp/fake/location/src/bar.ts',
        '/tmp/fake/location/src/foo.ts',
      ]);
      glob.withArgs('/tmp/fake/location/test/**/*.ts').returns([
        '/tmp/fake/location/test/index.spec.ts',
        '/tmp/fake/location/test/bar.spec.ts',
        '/tmp/fake/location/test/foo.spec.ts',
      ]);
      const fromFile = stub(hasha, 'fromFile');
      fromFile.rejects();
      fromFile.withArgs('/tmp/fake/location/src/index.ts', { algorithm: 'sha256' }).resolves(Buffer.from('1234'));
      fromFile.withArgs('/tmp/fake/location/src/bar.ts', { algorithm: 'sha256' }).resolves(Buffer.from('5678'));
      fromFile.withArgs('/tmp/fake/location/src/foo.ts', { algorithm: 'sha256' }).resolves(Buffer.from('9012'));
      fromFile.withArgs('/tmp/fake/location/test/bar.spec.ts', { algorithm: 'sha256' }).resolves(Buffer.from('3456'));
      fromFile.withArgs('/tmp/fake/location/test/index.spec.ts', { algorithm: 'sha256' }).resolves(Buffer.from('7890'));
      fromFile.withArgs('/tmp/fake/location/test/foo.spec.ts', { algorithm: 'sha256' }).resolves(Buffer.from('1234'));
      const cache = new Cache(workspace as unknown as Workspace, 'foo');
      const checksum = new Checksum(cache);
      const calculated = await checksum.calculate();
      glob.restore();
      fromFile.restore();
      expect(calculated).toEqual({
        "args": "[]",
        "cmd": "npm run foo",
        "env": "{}",
        "globs": "src/**/*.ts,test/**/*.ts",
        '/tmp/fake/location/src/index.ts': Buffer.from('1234'),
        '/tmp/fake/location/src/bar.ts': Buffer.from('5678'),
        '/tmp/fake/location/src/foo.ts': Buffer.from('9012'),
        '/tmp/fake/location/test/index.spec.ts': Buffer.from('7890'),
        '/tmp/fake/location/test/bar.spec.ts': Buffer.from('3456'),
        '/tmp/fake/location/test/foo.spec.ts': Buffer.from('1234'),
      });
    });
    it('should accept an array af commands', async () => {
      const workspace = {
        root: '/tmp/fake/location',
        config: {
          foo: {
            cmd: ["npm run pre:test", "npm run test"],
            src: ["src/**/*.ts"]
          }
        }
      }
      const glob = stub(fastGlob, 'sync');
      glob.returns(['wat']);
      glob.withArgs('/tmp/fake/location/src/**/*.ts').returns([
        '/tmp/fake/location/src/index.ts',
      ]);
      const fromFile = stub(hasha, 'fromFile');
      fromFile.rejects();
      fromFile.withArgs('/tmp/fake/location/src/index.ts', { algorithm: 'sha256' }).resolves(Buffer.from('1234'));
      const cache = new Cache(workspace as unknown as Workspace, 'foo');
      const checksum = new Checksum(cache);
      const calculated = await checksum.calculate();
      glob.restore();
      fromFile.restore();
      expect(calculated).toEqual({
        "args": "[]",
        "env": "{}",
        "cmd": "npm run pre:test,npm run test",
        "globs": "src/**/*.ts",
        '/tmp/fake/location/src/index.ts': Buffer.from('1234'),
      });
    });
    it('should throw if not file are matching', async () => {
      const workspace = {
        root: '/tmp/fake/location',
        config: {
          foo: {
            src: [
              "src/**/*.ts",
              "test/**/*.ts",
            ]
          }
        }
      }
      const glob = stub(fastGlob, 'sync');
      glob.throws();
      glob.withArgs('/tmp/fake/location/src/**/*.ts').returns([]);
      glob.withArgs('/tmp/fake/location/test/**/*.ts').returns([]);
      try {
        const cache = new Cache(workspace as unknown as Workspace, 'foo');
        const checksum = new Checksum(cache);
        await checksum.calculate();
        glob.restore();
        fail('should throw');
      } catch (e) {
        glob.restore();
        expect(e instanceof CentipodError).toBe(true);
        expect((e as CentipodError).code).toBe(CentipodErrorCode.NO_FILES_TO_CACHE);
      }
    });
    it.todo('should split processing in one-thousand elements batch to avoid EMFILE error');
  })
})
