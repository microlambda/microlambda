import { SinonStub, stub } from 'sinon';
import { glob } from 'glob';
import { resolveSharedInfrastructureYamls } from './resolve-path';
import { IRootConfig } from '@microlambda/config';

describe('The shared infra path resolver', () => {
  const stubs: Record<string, SinonStub> = {};
  beforeEach(() => {
    stubs.glob = stub(glob, 'sync');
  });
  afterEach(() => {
    Object.values(stubs).forEach((s) => s.restore());
  });
  it('should match all globs', () => {
    stubs.glob
      .withArgs('foo/*/serverless.yml', { cwd: 'Users/bob/my-app' })
      .returns(['foo/bar/serverless.yml', 'foo/baz/serverless.yml']);
    stubs.glob
      .withArgs('bar/*/serverless.yml', { cwd: 'Users/bob/my-app' })
      .returns(['bar/foo/serverless.yml', 'bar/baz/serverless.yml']);
    const config = { sharedResources: ['foo/*/serverless.yml', 'bar/*/serverless.yml'] } as IRootConfig;
    expect(resolveSharedInfrastructureYamls(config, 'Users/bob/my-app')).toEqual([
      'foo/bar/serverless.yml',
      'foo/baz/serverless.yml',
      'bar/foo/serverless.yml',
      'bar/baz/serverless.yml',
    ]);
  });
  it('should ignore non-severless.yml', () => {
    const config = { sharedResources: 'infra/**/*.yml' } as IRootConfig;
    stubs.glob
      .withArgs('infra/**/*.yml', { cwd: 'Users/bob/my-app' })
      .returns(['infra/shared/cloudformation.yml', 'infra/shared/serverless.yml', 'infra/env/serverless.yml']);
    expect(resolveSharedInfrastructureYamls(config, 'Users/bob/my-app')).toEqual([
      'infra/shared/serverless.yml',
      'infra/env/serverless.yml',
    ]);
  });
});
