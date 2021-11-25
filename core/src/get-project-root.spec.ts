/**
 * Recursively find microlambda project root
 *
 *  Let say we have this organization on the filesystem
 *
 * /
 *   users/
 *     john/
 *       project-1/
 *          .microlambdarc
 *           packages/
 *              utils/
 *                src/
 *                  index.ts
 *       project-2/
 *          no-a-lerna-project
 *
 */
import { SinonStub, stub } from 'sinon';
import fs from 'fs';
import * as projectRoot from './get-project-root';
import { Logger } from './logger';
import { MilaError, MilaErrorCode } from './errors';

describe('[method] findProjectRoot', () => {
  let stubs: {
    cwd: SinonStub;
    existSync: SinonStub;
  };
  beforeEach(() => {
    stubs = {
      cwd: stub(process, 'cwd'),
      existSync: stub(fs, 'existsSync'),
    };
    stubs.existSync.returns(false);
    stubs.existSync.withArgs('/users/john/project-1/.microlambdarc').returns(true);
  });
  afterEach(() => {
    stubs.cwd.restore();
    stubs.existSync.restore();
  });
  it('should find project root at project root', () => {
    stubs.cwd.returns('/users/john/project-1');
    expect(projectRoot.findProjectRoot()).toBe('/users/john/project-1');
  });
  it('should find project root in a nested directory', () => {
    stubs.cwd.returns('/users/john/project-1/packages/utils/src');
    expect(projectRoot.findProjectRoot()).toBe('/users/john/project-1');
  });
  it('should throw if not a microlambda project', () => {
    stubs.cwd.returns('/users/john/project-2');
    try {
      projectRoot.findProjectRoot();
    } catch (e) {
      expect((e as MilaError).code).toBe(MilaErrorCode.NOT_IN_A_VALID_LERNA_PROJECT);
    }
  });
});

describe('[method] getProjectRoot', () => {
  let findProjectRoot: SinonStub;
  let exit: SinonStub;
  let consoleError: SinonStub;
  beforeEach(() => {
    findProjectRoot = stub(projectRoot, 'findProjectRoot');
    exit = stub(process, 'exit');
    consoleError = stub(console, 'error');
  });
  afterEach(() => {
    findProjectRoot.restore();
    exit.restore();
    consoleError.restore();
  });
  it('should find project', () => {
    findProjectRoot.returns('/users/john/project-1');
    expect(projectRoot.getProjectRoot(new Logger())).toBe('/users/john/project-1');
  });
  it('should exit 1 and print error message if not in a valid mila project', () => {
    const e = new MilaError(MilaErrorCode.NOT_IN_A_VALID_LERNA_PROJECT);
    findProjectRoot.throws(e);
    projectRoot.getProjectRoot(new Logger());
    expect(exit.callCount).toBe(1);
    expect(consoleError.callCount).toBe(1);
    expect(exit.getCalls()[0].args).toEqual([1]);
  });
  it('should exit 1 and print error message if any error occurs while resolving project root', () => {
    findProjectRoot.throws(new Error('fs error'));
    projectRoot.getProjectRoot(new Logger());
    expect(exit.callCount).toBe(1);
    expect(consoleError.callCount).toBe(2);
    expect(exit.getCalls()[0].args).toEqual([1]);
  });
});
