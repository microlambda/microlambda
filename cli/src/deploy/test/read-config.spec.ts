/*
TODO Update unit tests
import { SinonStub, stub } from 'sinon';
import { ILernaPackage, LernaHelper } from '../../utils/lerna';
import fs, { ReadOptions, PathLike } from 'fs-extra';
import { ConfigReader } from '../../config/read-config';

describe('The configuration reader class', () => {
  let getServices: SinonStub<[string?], Promise<ILernaPackage[]>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let readJSONSync: SinonStub<[string, ReadOptions?], any>;
  let existsSync: SinonStub<[PathLike], boolean>;
  beforeAll(() => {
    readJSONSync = stub(fs, 'readJSONSync');
    getServices = stub(LernaHelper.prototype, 'getServices');
    getServices.resolves([
      {
        name: 'service-1',
        version: '0.0.1',
        location: 'some/where/on/fs',
        private: true,
      },
      {
        name: 'service-2',
        version: '0.0.1',
        location: 'some/where/on/fs',
        private: true,
      },
      {
        name: 'service-3',
        version: '0.0.1',
        location: 'some/where/on/fs',
        private: true,
      },
    ]);
  });
  afterAll(() => {
    getServices.restore();
    readJSONSync.restore();
  });
  beforeEach(() => {
    existsSync = stub(fs, 'existsSync');
    existsSync.returns(true);
  });
  afterEach(() => {
    existsSync.restore();
  });
  describe('The configuration validation schema', () => {
    it('should validate simple default region configuration', async () => {
      const configReader = new ConfigReader();
      const expected = {
        defaultRegions: 'eu-west-1',
      };
      readJSONSync.returns(expected);
      const config = await configReader.readConfig();
      expect(config).toEqual(expected);
    });
    it('should validate simple default region configuration array', async () => {
      const configReader = new ConfigReader();
      const expected = {
        defaultRegions: ['eu-west-1', 'ap-southeast-2'],
      };
      readJSONSync.returns(expected);
      const config = await configReader.readConfig();
      expect(config).toEqual(expected);
    });
    it('should validate complex default region configuration', async () => {
      const configReader = new ConfigReader();
      const expected = {
        defaultRegions: {
          dev: 'eu-west-1',
          prod: ['eu-west-1', 'us-east-1', 'ap-southeast-2'],
        },
      };
      readJSONSync.returns(expected);
      const config = await configReader.readConfig();
      expect(config).toEqual(expected);
    });
    it('should validate simple region configuration', async () => {
      const configReader = new ConfigReader();
      const expected = {
        regions: {
          'service-1': 'eu-west-1',
          'service-2': ['eu-west-1', 'us-east-1', 'ap-southeast-2'],
          'service-3': 'eu-west-1',
        },
      };
      readJSONSync.returns(expected);
      const config = await configReader.readConfig();
      expect(config).toEqual(expected);
    });
    it('should validate complex region configuration', async () => {
      const configReader = new ConfigReader();
      const expected = {
        regions: {
          'service-1': {
            dev: 'eu-west-1',
            prod: ['eu-west-1', 'us-east-1', 'ap-southeast-2'],
          },
          'service-2': ['eu-west-1', 'us-east-1', 'ap-southeast-2'],
          'service-3': {
            dev: 'eu-west-1',
            staging: 'ap-southeast-2',
            prod: ['eu-west-1', 'us-east-1', 'ap-southeast-2'],
          },
        },
      };
      readJSONSync.returns(expected);
      const config = await configReader.readConfig();
      expect(config).toEqual(expected);
    });
    it('should fail if region does not exist in default region configuration', async () => {
      const configReader = new ConfigReader();
      const expected = {
        defaultRegions: ['eu-west-12'],
      };
      readJSONSync.returns(expected);
      try {
        await configReader.readConfig();
        fail('should throw');
      } catch (e) {
        expect(e).toBeTruthy();
      }
    });
    it('should fail if service does not exist in region configuration', async () => {
      const configReader = new ConfigReader();
      const expected = {
        regions: {
          'service-1': 'eu-west-1',
          'service-2': ['eu-west-1', 'us-east-1', 'ap-southeast-24'],
          'service-3': 'eu-west-1',
        },
      };
      readJSONSync.returns(expected);
      try {
        await configReader.readConfig();
        fail('should throw');
      } catch (e) {
        expect(e).toBeTruthy();
      }
    });
    it('should validate simple steps configuration', async () => {
      const configReader = new ConfigReader();
      const expected = {
        steps: [['service-1'], ['service-2', 'service-3']],
      };
      readJSONSync.returns(expected);
      const config = await configReader.readConfig();
      expect(config).toEqual(expected);
    });
    it('should validate simple steps configuration with wildcard', async () => {
      const configReader = new ConfigReader();
      const expected = {
        steps: [['service-1'], '*'],
      };
      readJSONSync.returns(expected);
      const config = await configReader.readConfig();
      expect(config).toEqual(expected);
    });
    it('should fail if service does not exist in steps configuration', async () => {
      const configReader = new ConfigReader();
      const expected = {
        steps: [['service-12'], '*'],
      };
      readJSONSync.returns(expected);
      try {
        await configReader.readConfig();
        fail('should throw');
      } catch (e) {
        expect(e).toBeTruthy();
      }
    });
  });
  describe('The get region method', () => {
    it('should find region for microservice for the given stage [string]', async () => {
      readJSONSync.returns({
        regions: {
          'service-1': 'eu-west-1',
        },
      });
      const configReader = new ConfigReader();
      const resolved = await configReader.getRegions('service-1', 'dev');
      expect(resolved).toEqual(['eu-west-1']);
    });
    it('should find region for microservice for the given stage [array]', async () => {
      readJSONSync.returns({
        regions: {
          'service-1': ['eu-west-1', 'ap-southeast-2'],
        },
      });
      const configReader = new ConfigReader();
      const resolved = await configReader.getRegions('service-1', 'dev');
      expect(resolved).toEqual(['eu-west-1', 'ap-southeast-2']);
    });
    it('should find region for microservice for the given stage [object]', async () => {
      readJSONSync.returns({
        regions: {
          'service-1': {
            dev: ['eu-west-3'],
          },
        },
      });
      const configReader = new ConfigReader();
      const resolved = await configReader.getRegions('service-1', 'dev');
      expect(resolved).toEqual(['eu-west-3']);
    });
    it('should fallback on general default region for the given stage if no entry', async () => {
      readJSONSync.returns({
        defaultRegions: 'eu-west-1',
        regions: {
          'service-1': {
            dev: ['eu-west-3'],
          },
        },
      });
      const configReader = new ConfigReader();
      const resolved = await configReader.getRegions('service-1', 'staging');
      expect(resolved).toEqual(['eu-west-1']);
    });
    it('should fallback on general default region if no entry', async () => {
      readJSONSync.returns({
        defaultRegions: ['eu-west-1', 'ap-southeast-2'],
        regions: {
          'service-2': {
            dev: ['eu-west-3'],
          },
        },
      });
      const configReader = new ConfigReader();
      const resolved = await configReader.getRegions('service-1', 'dev');
      expect(resolved).toEqual(['eu-west-1', 'ap-southeast-2']);
    });
    it('should fallback on given stage default region when no entry for the stage', async () => {
      readJSONSync.returns({
        defaultRegions: { staging: 'eu-west-1' },
        regions: {
          'service-1': {
            dev: ['eu-west-3'],
          },
        },
      });
      const configReader = new ConfigReader();
      const resolved = await configReader.getRegions('service-1', 'staging');
      expect(resolved).toEqual(['eu-west-1']);
    });
    it('should fallback on given stage default region if no entry', async () => {
      readJSONSync.returns({
        defaultRegions: { dev: ['eu-west-1', 'ap-southeast-2'] },
        regions: {
          'service-2': {
            dev: ['eu-west-3'],
          },
        },
      });
      const configReader = new ConfigReader();
      const resolved = await configReader.getRegions('service-1', 'dev');
      expect(resolved).toEqual(['eu-west-1', 'ap-southeast-2']);
    });
    it('should fallback on environment region if no entry for service and no default region', async () => {
      process.env.AWS_REGION = 'eu-west-1';
      readJSONSync.returns({
        regions: {
          'service-2': {
            dev: ['eu-west-3'],
          },
        },
      });
      const configReader = new ConfigReader();
      const resolved = await configReader.getRegions('service-1', 'dev');
      expect(resolved).toEqual(['eu-west-1']);
    });
    it('should fallback on environment region if no entry for service and no entry for default region stage', async () => {
      process.env.AWS_REGION = 'eu-west-1';
      readJSONSync.returns({
        defaultRegions: { staging: ['eu-west-1', 'ap-southeast-2'] },
        regions: {
          'service-2': {
            dev: ['eu-west-3'],
          },
        },
      });
      const configReader = new ConfigReader();
      const resolved = await configReader.getRegions('service-1', 'dev');
      expect(resolved).toEqual(['eu-west-1']);
    });
    it('should fallback on environment region if no entry stage for service and no default region', async () => {
      process.env.AWS_REGION = 'eu-west-1';
      readJSONSync.returns({
        regions: {
          'service-1': {
            dev: ['eu-west-3'],
          },
        },
      });
      const configReader = new ConfigReader();
      const resolved = await configReader.getRegions('service-1', 'staging');
      expect(resolved).toEqual(['eu-west-1']);
    });
    it('should fallback on environment region if no entry stage for service and no entry for default region stage', async () => {
      process.env.AWS_REGION = 'eu-west-1';
      readJSONSync.returns({
        defaultRegions: { prod: ['eu-west-1', 'ap-southeast-2'] },
        regions: {
          'service-1': {
            dev: ['eu-west-3'],
          },
        },
      });
      const configReader = new ConfigReader();
      const resolved = await configReader.getRegions('service-1', 'staging');
      expect(resolved).toEqual(['eu-west-1']);
    });
    it('should use default region if not config', async () => {
      process.env.AWS_REGION = 'eu-west-1';
      existsSync.returns(false);
      const configReader = new ConfigReader();
      const resolved = await configReader.getRegions('service-1', 'staging');
      expect(resolved).toEqual(['eu-west-1']);
    });
    it('should throw if no fallback available on environment region [1]', async () => {
      delete process.env.AWS_REGION;
      readJSONSync.returns({
        defaultRegions: { staging: ['eu-west-1', 'ap-southeast-2'] },
        regions: {
          'service-2': {
            dev: ['eu-west-3'],
          },
        },
      });
      const configReader = new ConfigReader();
      try {
        await configReader.getRegions('service-1', 'dev');
        fail('should throw');
      } catch (e) {
        expect(e).toBeTruthy();
      }
    });
    it('should throw if no fallback available on environment region [2]', async () => {
      delete process.env.AWS_REGION;
      readJSONSync.returns({
        regions: {
          'service-1': {
            dev: ['eu-west-3'],
          },
        },
      });
      const configReader = new ConfigReader();
      try {
        await configReader.getRegions('service-1', 'prod');
        fail('should throw');
      } catch (e) {
        expect(e).toBeTruthy();
      }
    });
    it('should throw if no fallback available on environment region [3]', async () => {
      delete process.env.AWS_REGION;
      readJSONSync.returns({
        defaultRegions: { prod: ['eu-west-1', 'ap-southeast-2'] },
        regions: {
          'service-1': {
            dev: ['eu-west-3'],
          },
        },
      });
      const configReader = new ConfigReader();
      try {
        await configReader.getRegions('service-1', 'staging');
        fail('should throw');
      } catch (e) {
        expect(e).toBeTruthy();
      }
    });
    it('should throw if no config and no environment region', async () => {
      delete process.env.AWS_REGION;
      existsSync.returns(false);
      const configReader = new ConfigReader();
      try {
        await configReader.getRegions('service-1', 'dev');
        fail('should throw');
      } catch (e) {
        expect(e).toBeTruthy();
      }
    });
  });
  describe('The schedule deployment method', () => {
    it('should build one step in one region if nothing specified', async () => {
      process.env.AWS_REGION = 'eu-west-1';
      existsSync.returns(false);
      const configReader = new ConfigReader();
      const steps = await configReader.scheduleDeployments('dev');
      expect(steps).toEqual([new Map([['eu-west-1', new Set(['service-1', 'service-2', 'service-3'])]])]);
    });
    it('should build one step in all regions not specified', async () => {
      readJSONSync.returns({
        defaultRegions: ['eu-west-1', 'ap-southeast-2'],
        regions: {
          'service-1': {
            dev: ['eu-west-3'],
          },
        },
      });
      const configReader = new ConfigReader();
      const steps = await configReader.scheduleDeployments('dev');
      expect(steps).toEqual([
        new Map([
          ['eu-west-1', new Set(['service-2', 'service-3'])],
          ['eu-west-3', new Set(['service-1'])],
          ['ap-southeast-2', new Set(['service-2', 'service-3'])],
        ]),
      ]);
    });
    it('should build deployment step', async () => {
      readJSONSync.returns({
        defaultRegions: ['eu-west-1', 'ap-southeast-2'],
        regions: {
          'service-2': {
            prod: ['eu-west-1', 'ap-southeast-2', 'us-west-1'],
          },
        },
        steps: [['service-1'], ['service-2'], ['service-3']],
      });
      const configReader = new ConfigReader();
      const steps = await configReader.scheduleDeployments('dev');
      expect(steps).toEqual([
        new Map([
          ['eu-west-1', new Set(['service-1'])],
          ['ap-southeast-2', new Set(['service-1'])],
        ]),
        new Map([
          ['eu-west-1', new Set(['service-2'])],
          ['ap-southeast-2', new Set(['service-2'])],
        ]),
        new Map([
          ['eu-west-1', new Set(['service-3'])],
          ['ap-southeast-2', new Set(['service-3'])],
        ]),
      ]);
    });
    it('should build deployment step with wildcard [1]', async () => {
      readJSONSync.returns({
        defaultRegions: { prod: ['eu-west-1', 'ap-southeast-2'] },
        regions: {
          'service-2': {
            prod: ['eu-west-1', 'ap-southeast-2', 'us-west-1'],
          },
        },
        steps: ['*', ['service-3']],
      });
      const configReader = new ConfigReader();
      const steps = await configReader.scheduleDeployments('prod');
      expect(steps).toEqual([
        new Map([
          ['eu-west-1', new Set(['service-1', 'service-2'])],
          ['ap-southeast-2', new Set(['service-1', 'service-2'])],
          ['us-west-1', new Set(['service-2'])],
        ]),
        new Map([
          ['eu-west-1', new Set(['service-3'])],
          ['ap-southeast-2', new Set(['service-3'])],
        ]),
      ]);
    });
    it('should build deployment step with wildcard [2]', async () => {
      readJSONSync.returns({
        defaultRegions: { prod: ['eu-west-1', 'ap-southeast-2'] },
        regions: {
          'service-2': {
            prod: ['eu-west-1', 'ap-southeast-2', 'us-west-1'],
          },
        },
        steps: [['service-1'], '*', ['service-3']],
      });
      const configReader = new ConfigReader();
      const steps = await configReader.scheduleDeployments('prod');
      expect(steps).toEqual([
        new Map([
          ['eu-west-1', new Set(['service-1'])],
          ['ap-southeast-2', new Set(['service-1'])],
        ]),
        new Map([
          ['eu-west-1', new Set(['service-2'])],
          ['ap-southeast-2', new Set(['service-2'])],
          ['us-west-1', new Set(['service-2'])],
        ]),
        new Map([
          ['eu-west-1', new Set(['service-3'])],
          ['ap-southeast-2', new Set(['service-3'])],
        ]),
      ]);
    });
    it('should build deployment step with wildcard [3]', async () => {
      readJSONSync.returns({
        defaultRegions: { prod: ['eu-west-1', 'ap-southeast-2'] },
        regions: {
          'service-2': {
            prod: ['eu-west-1', 'ap-southeast-2', 'us-west-1'],
          },
        },
        steps: [['service-2'], '*'],
      });
      const configReader = new ConfigReader();
      const steps = await configReader.scheduleDeployments('prod');
      expect(steps).toEqual([
        new Map([
          ['eu-west-1', new Set(['service-2'])],
          ['ap-southeast-2', new Set(['service-2'])],
          ['us-west-1', new Set(['service-2'])],
        ]),
        new Map([
          ['eu-west-1', new Set(['service-1', 'service-3'])],
          ['ap-southeast-2', new Set(['service-1', 'service-3'])],
        ]),
      ]);
    });
  });
  describe('The getAll regions method', () => {
    it('should return only default region if no config', async () => {
      process.env.AWS_REGION = 'us-east-3';
      existsSync.returns(false);
      const configReader = new ConfigReader();
      const regions = await configReader.getAllRegions('staging');
      expect(regions).toEqual(['us-east-3']);
    });
    it('should return all regions in config [1]', async () => {
      process.env.AWS_REGION = 'us-east-3';
      readJSONSync.returns({
        regions: {
          'service-3': {
            dev: ['eu-west-2'],
            prod: ['eu-west-3', 'ap-southeast-1'],
          },
          'service-2': {
            dev: ['us-west-2', 'us-east-1'],
            prod: ['cn-north-1'],
          },
        },
      });
      const configReader = new ConfigReader();
      const regions = await configReader.getAllRegions('prod');
      expect(regions.sort()).toEqual(['us-east-3', 'eu-west-3', 'ap-southeast-1', 'cn-north-1'].sort());
    });
    it('should return all regions in config [2]', async () => {
      delete process.env.AWS_REGION;
      readJSONSync.returns({
        defaultRegions: 'eu-west-1',
        regions: {
          'service-1': ['ap-southeast-2', 'eu-central-1'],
          'service-3': {
            dev: ['eu-west-2'],
            prod: ['eu-west-3', 'ap-southeast-1'],
          },
          'service-2': {
            dev: ['us-west-2', 'us-east-1'],
            prod: ['cn-north-1'],
          },
        },
      });
      const configReader = new ConfigReader();
      const regions = await configReader.getAllRegions('dev');
      expect(regions.sort()).toEqual(['ap-southeast-2', 'eu-central-1', 'eu-west-2', 'us-west-2', 'us-east-1'].sort());
    });
  });
});
 */
