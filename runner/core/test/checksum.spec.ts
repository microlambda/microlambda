import { SinonStub, stub } from 'sinon';
import { Checksums, Project, Workspace } from '../src';
import fastGlob from 'fast-glob';
import hasha from 'hasha';
import { MilaError, MilaErrorCode } from '@microlambda/errors';
import { ISourcesChecksums } from '../lib';
import { getProject } from './mocks/utils';
import { fs as fsUtils } from '@microlambda/utils';

describe('[class] Checksum manager', () => {
  let project: Project;
  beforeEach(async() => {
    project = await getProject({});
  })
  describe('[method] calculate', () => {
    it('should compute and store sha256 checksums for the files described by globs array', async () => {
      const workspace = project.workspaces.get('@org/workspace-a');
      const glob = stub(fastGlob, 'sync');
      const fs = stub(fsUtils, 'exists');

      glob.withArgs('/somewhere/on/filesystem/packages/workspace-a/src/**/*.ts').returns([
        '/somewhere/on/filesystem/packages/workspace-a/src/index.ts',
        '/somewhere/on/filesystem/packages/workspace-a/src/bar.ts',
        '/somewhere/on/filesystem/packages/workspace-a/src/foo.ts',
      ]);
      glob.withArgs('/somewhere/on/filesystem/packages/workspace-a/test/**/*.ts').returns([
        '/somewhere/on/filesystem/packages/workspace-a/test/index.spec.ts',
        '/somewhere/on/filesystem/packages/workspace-a/test/bar.spec.ts',
        '/somewhere/on/filesystem/packages/workspace-a/test/foo.spec.ts',
      ]);
      const fromFile: SinonStub = stub(hasha, 'fromFile');
      fromFile.rejects();
      fs.resolves(false);
      fs.withArgs('/somewhere/on/filesystem/packages/workspace-a/src/index.ts').resolves(true);
      fs.withArgs('/somewhere/on/filesystem/packages/workspace-a/src/bar.ts').resolves(true);
      fs.withArgs('/somewhere/on/filesystem/packages/workspace-a/src/foo.ts').resolves(true);
      fs.withArgs('/somewhere/on/filesystem/packages/workspace-a/test/bar.spec.ts').resolves(true);
      fs.withArgs('/somewhere/on/filesystem/packages/workspace-a/test/index.spec.ts').resolves(true);
      fs.withArgs('/somewhere/on/filesystem/packages/workspace-a/test/foo.spec.ts').resolves(true);
      fromFile.withArgs('/somewhere/on/filesystem/packages/workspace-a/src/index.ts', { algorithm: 'sha256' }).resolves('1234');
      fromFile.withArgs('/somewhere/on/filesystem/packages/workspace-a/src/bar.ts', { algorithm: 'sha256' }).resolves('5678');
      fromFile.withArgs('/somewhere/on/filesystem/packages/workspace-a/src/foo.ts', { algorithm: 'sha256' }).resolves('9012');
      fromFile.withArgs('/somewhere/on/filesystem/packages/workspace-a/test/bar.spec.ts', { algorithm: 'sha256' }).resolves('3456');
      fromFile.withArgs('/somewhere/on/filesystem/packages/workspace-a/test/index.spec.ts', { algorithm: 'sha256' }).resolves('7890');
      fromFile.withArgs('/somewhere/on/filesystem/packages/workspace-a/test/foo.spec.ts', { algorithm: 'sha256' }).resolves('1234');
      const checksum = new Checksums(workspace as Workspace, 'foo');
      const calculated = await checksum.calculate();
      glob.restore();
      fs.restore();
      fromFile.restore();
      const expected: ISourcesChecksums = {
        "args": [],
        "cmd": ["npm run foo"],
        "env": {},
        "globs": { internals: [ "src/**/*.ts", "test/**/*.ts"], deps: [], root: [] },
        checksums: {
          '/somewhere/on/filesystem/packages/workspace-a/src/index.ts': '1234',
          '/somewhere/on/filesystem/packages/workspace-a/src/bar.ts': '5678',
          '/somewhere/on/filesystem/packages/workspace-a/src/foo.ts': '9012',
          '/somewhere/on/filesystem/packages/workspace-a/test/index.spec.ts': '7890',
          '/somewhere/on/filesystem/packages/workspace-a/test/bar.spec.ts': '3456',
          '/somewhere/on/filesystem/packages/workspace-a/test/foo.spec.ts': '1234',
        }
      }
      expect(calculated).toEqual(expected);
    });
    it('should accept an array af commands', async () => {
      const workspace = project.workspaces.get('@org/workspace-a');
      const glob = stub(fastGlob, 'sync');
      const fs = stub(fsUtils, 'exists');
      fs.resolves(false);
      fs.withArgs('/somewhere/on/filesystem/packages/workspace-a/src/index.ts').resolves(true);
      glob.withArgs('/somewhere/on/filesystem/packages/workspace-a/src/**/*.ts').returns([
        '/somewhere/on/filesystem/packages/workspace-a/src/index.ts',
      ]);
      const fromFile: SinonStub = stub(hasha, 'fromFile');
      fromFile.rejects();
      fromFile.withArgs('/somewhere/on/filesystem/packages/workspace-a/src/index.ts', { algorithm: 'sha256' }).resolves('1234');
      const checksum = new Checksums(workspace as Workspace, 'bar');
      const calculated = await checksum.calculate();
      glob.restore();
      fromFile.restore();
      fs.restore();
      const expected: ISourcesChecksums = {
        "args": [],
        "env": {},
        "cmd": ["npm run pre:test", "npm run test"],
        "globs": { internals: ['src/**/*.ts'], deps: [], root: [] },
        checksums: {
          '/somewhere/on/filesystem/packages/workspace-a/src/index.ts': '1234',
        }
      }
      expect(calculated).toEqual(expected);
    });
    it('should throw if not file are matching', async () => {
      const workspace = project.workspaces.get('@org/workspace-a');
      const glob = stub(fastGlob, 'sync');
      glob.withArgs('/somewhere/on/filesystem/packages/workspace-a/src/**/*.ts').returns([]);
      glob.withArgs('/somewhere/on/filesystem/packages/workspace-a/test/**/*.ts').returns([]);
      try {
        const checksum = new Checksums(workspace as Workspace, 'foo');
        await checksum.calculate();
        glob.restore();
        fail('should throw');
      } catch (e) {
        glob.restore();
        expect(e instanceof MilaError).toBe(true);
        expect((e as MilaError).code).toBe(MilaErrorCode.NO_FILES_TO_CACHE);
      }
    });
    it.todo('should split processing in one-thousand elements batch to avoid EMFILE error');
  })
})
