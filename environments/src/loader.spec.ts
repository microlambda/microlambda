import { SinonStub, stub } from 'sinon';
import { fs } from '@microlambda/utils';
import { ConfigReader } from '@microlambda/config';
import dotenv from 'dotenv';
import { aws } from '@microlambda/aws';
import { EnvironmentLoader } from '.';
import { Project, Workspace } from '@microlambda/runner-core';
import { MilaError, MilaErrorCode } from '@microlambda/errors';

describe('[class] The environment loader', () => {

  const stubs: Record<string, SinonStub> = {};
  const workspace: Workspace = {
    root: '/project/root/services/foo',
  } as Workspace;
  const project: Project = {
    root: '/project/root',
    workspaces: new Map([
      ['foo', workspace]
    ]),
  } as Project;

  beforeEach(() => {
    stubs.fsExists = stub(fs, 'exists');
    stubs.rootConfig = stub(ConfigReader.prototype, 'rootConfig').get(() => ({
      defaultRegion: 'eu-west-1',
    }));
    stubs.dotenvParse = stub(dotenv, 'parse');
    stubs.getSecretValue = stub(aws.secretsManager, 'getSecretValue');
  });

  afterEach(() => Object.values(stubs).forEach((s) => s.restore()));

  describe('[method] loadGlobal', () => {
    it('should load empty environment is .env files do ont exist', async () => {
      stubs.fsExists.withArgs('/project/root/.env').resolves(false);
      stubs.fsExists.withArgs('/project/root/.env.test').resolves(false);
      expect(await (new EnvironmentLoader(project).loadGlobal('test'))).toEqual([]);
    });
    it('should load environment from .env files',   async() => {
      stubs.fsExists.withArgs('/project/root/.env').resolves(true);
      stubs.fsExists.withArgs('/project/root/.env.test').resolves(true);
      stubs.dotenvParse.throws('Unexpected arguments');
      stubs.dotenvParse.withArgs('/project/root/.env').returns({
        GLOBAL_VAR: 'foo',
      });
      stubs.dotenvParse.withArgs('/project/root/.env.test').returns({
        GLOBAL_TEST_VAR: 'bar',
      });
      expect(await (new EnvironmentLoader(project).loadGlobal('test'))).toEqual([
        {
          key: 'GLOBAL_VAR',
          value: 'foo',
          from: '/project/root/.env',
        },
        {
          key: 'GLOBAL_TEST_VAR',
          value: 'bar',
          from: '/project/root/.env.test',
        },
      ]);
    });
    it('should interpolate not-versioned secret',   async() => {
      stubs.fsExists.withArgs('/project/root/.env').resolves(true);
      stubs.fsExists.withArgs('/project/root/.env.test').resolves(false);
      stubs.dotenvParse.throws('Unexpected arguments');
      stubs.dotenvParse.withArgs('/project/root/.env').returns({
        SECRET_VAR: '${ssm:/super/secret/string}',
      });
      stubs.getSecretValue.rejects('Invalid arguments');
      stubs.getSecretValue.withArgs('eu-west-1', '/super/secret/string').resolves('s3cr3t');
      expect(await (new EnvironmentLoader(project).loadGlobal('test'))).toEqual([
        {
          key: 'SECRET_VAR',
          value: 's3cr3t',
          from: '/project/root/.env',
          secret: {
            name: '/super/secret/string',
            region: 'eu-west-1',
            version: undefined,
          }
        },
      ]);
    });
    it('should interpolate versioned secret',   async() => {
      stubs.fsExists.withArgs('/project/root/.env').resolves(true);
      stubs.fsExists.withArgs('/project/root/.env.test').resolves(false);
      stubs.dotenvParse.throws('Unexpected arguments');
      stubs.dotenvParse.withArgs('/project/root/.env').returns({
        SECRET_VAR: '${ssm:/super/secret/string:4}',
      });
      stubs.getSecretValue.rejects('Invalid arguments');
      stubs.getSecretValue.withArgs('eu-west-1', '/super/secret/string', '4').resolves('s3cr3t');
      expect(await (new EnvironmentLoader(project).loadGlobal('test'))).toEqual([
        {
          key: 'SECRET_VAR',
          value: 's3cr3t',
          from: '/project/root/.env',
          secret: {
            name: '/super/secret/string',
            region: 'eu-west-1',
            version: '4',
          }
        },
      ]);
    });
    it('should return empty string if secret manager response undefined', async() => {
      stubs.fsExists.withArgs('/project/root/.env').resolves(true);
      stubs.fsExists.withArgs('/project/root/.env.test').resolves(false);
      stubs.dotenvParse.throws('Unexpected arguments');
      stubs.dotenvParse.withArgs('/project/root/.env').returns({
        SECRET_VAR: '${ssm:/super/secret/string:4}',
      });
      stubs.getSecretValue.rejects('Invalid arguments');
      stubs.getSecretValue.withArgs('eu-west-1', '/super/secret/string', '4').resolves(undefined);
      expect(await (new EnvironmentLoader(project).loadGlobal('test'))).toEqual([
        {
          key: 'SECRET_VAR',
          value: '',
          from: '/project/root/.env',
          secret: {
            name: '/super/secret/string',
            region: 'eu-west-1',
            version: '4',
          }
        },
      ]);
    });
    it('should throw if secret manager call fails', async () => {
      try {
        stubs.fsExists.withArgs('/project/root/.env').resolves(true);
        stubs.fsExists.withArgs('/project/root/.env.test').resolves(false);
        stubs.dotenvParse.throws('Unexpected arguments');
        stubs.dotenvParse.withArgs('/project/root/.env').returns({
          SECRET_VAR: '${ssm:/super/secret/string:4}',
        });
        stubs.getSecretValue.rejects('Invalid arguments');
        stubs.getSecretValue.withArgs('eu-west-1', '/super/secret/string', '4').rejects('NotFound');
        await (new EnvironmentLoader(project).loadGlobal('test'));
        expect('test').toBe('failed');
      } catch (e) {
        expect((e as MilaError).code).toBe(MilaErrorCode.UNABLE_TO_LOAD_SECRET_VALUE);
      }
    });
  });
  describe('[method] loadServiceScoped', () => {
    it('should load environment for a given service (string)', async () => {
      stubs.fsExists.withArgs('/project/root/services/foo/.env').resolves(false);
      stubs.fsExists.withArgs('/project/root/services/foo/.env.test').resolves(false);
      expect(await (new EnvironmentLoader(project).loadServiceScoped('test', 'foo'))).toEqual([]);
    });
    it('should load environment for a given service (Workspace)', async () => {
      stubs.fsExists.withArgs('/project/root/services/foo/.env').resolves(false);
      stubs.fsExists.withArgs('/project/root/services/foo/.env.test').resolves(false);
      expect(await (new EnvironmentLoader(project).loadServiceScoped('test', workspace))).toEqual([]);
    });
    it('should throw if service does not exist', async () => {
      try {
        await (new EnvironmentLoader(project).loadServiceScoped('test', 'invalid'))
        expect('test').toBe('failed');
      } catch (e) {
        expect((e as MilaError).code).toBe(MilaErrorCode.UNABLE_TO_LOAD_WORKSPACE);
      }
    });
  })
});
