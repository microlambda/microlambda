/* eslint-disable no-console */
/*import { backupYaml, reformatYaml, restoreYaml } from './utils/reformat-yaml';
import { ConfigReader } from './utils/read-config';
import { CertificateManager } from './utils/generate-certificates';
import { RecordsManager } from './utils/create-cname-records';
import { command } from 'execa';
import { Packager } from '../package/packagr';
import { LernaGraph, Service } from '../lerna';

export interface IDeployOptions {
  bootstrap: boolean;
  compilePackages: boolean;
  compileServices: boolean;
  package: boolean;
}

export class RocketLauncher {
  private static readonly _defaultOptions: IDeployOptions = {
    bootstrap: true,
    compilePackages: true,
    compileServices: true,
    package: true,
  };

  private readonly _stage: string;
  private readonly _service: string;
  private readonly _options: IDeployOptions;
  private readonly _configReader: ConfigReader;
  private readonly _toDeploy: Service[];

  constructor(stage: string, service?: string, options?: Partial<IDeployOptions>) {
    this._stage = stage;
    this._service = service;
    this._options = options
      ? {
          ...RocketLauncher._defaultOptions,
          ...options,
        }
      : RocketLauncher._defaultOptions;
    console.info('Ready to launch rockets', this._options);
    this._configReader = new ConfigReader();
  }

  public async deploy(): Promise<void> {
    console.info('Deploying micro-services to', this._stage);
    await this._bootstrap();
    await this._compilePackages();
    await this._compileServices();
    await this._packageServices();
    await this._generateCertificates();
    await this._deployServices();
    await this._createRecordDNS();
  }

  private async _bootstrap(): Promise<void> {
    if (this._options.bootstrap) {
      console.info('Bootstrapping dependencies');
      await command('npx lerna bootstrap', { stdio: 'inherit' });
    } else {
      console.info('Skipped dependencies bootstrap');
    }
  }

  private async _compilePackages(): Promise<void> {
    if (this._options.compilePackages) {
      console.info('Compiling microservices');
      await command('npm run services:compile', { stdio: 'inherit' });
    } else {
      console.info('Skipped shared packages compilation');
    }
  }

  private async _generateCertificates(): Promise<void> {
    const certificateManager = new CertificateManager(this._toDeploy, this._configReader);
    await certificateManager.requestCertificates(this._stage);
  }

  private async _compileServices(): Promise<void> {
    if (this._options.compileServices) {
      const cmd = this._service ? `npm run services:build -- --scope=${this._service}` : 'npm run services:build';
      await command(cmd, { stdio: 'inherit' });
    } else {
      console.info('Skipped services compilation');
    }
  }

  private async _packageServices(): Promise<void> {
    if (this._options.package) {
      console.info('Packaging microservices');
      const packagerV2 = new Packager(this._toDeploy.map((s) => s));
      await packagerV2.bundle();
    } else {
      console.info('Skipped package');
    }
  }

  private async _deployServices(): Promise<void> {
    if (!this._service) {
      const steps = await this._configReader.scheduleDeployments(this._stage);
      for (const i in steps) {
        console.info('Deployment step #', i);
        const step = steps[i];
        for (const [region, microservices] of step.entries()) {
          const services: string[] = [...microservices];
          await RocketLauncher._deployServices(services, region, this._stage);
        }
      }
    } else {
      const regions = await this._configReader.getRegions(this._service, this._stage);
      for (const region of regions) {
        await RocketLauncher._deployServices([this._service], region, this._stage);
      }
    }
  }

  private async _createRecordDNS(): Promise<void> {
    console.info('Creating DNS records');
    const dnsManager = new RecordsManager();
    await dnsManager.createRecords(this._configReader, this._stage, this._toDeploy);
  }

  private static async _deployServices(services: string[], region: string, env: string): Promise<void> {
    console.info(`Deploying services to ${region}`, services);
    backupYaml(services);
    try {
        reformatYaml(services, region, env);
    await LernaHelper.runCommand('print', services, null, 1);
    const servicesWithCustomDomain = await RocketLauncher._servicesWithCustomDomain();
    const toCreateDomain = servicesWithCustomDomain.map((s) => s.name).filter((s) => services.includes(s));
    console.debug('Creating custom domain for services', toCreateDomain);
    if (toCreateDomain.length > 0) {
      await LernaHelper.runCommand('create-domain', toCreateDomain, region, 1, {
        AWS_REGION: region,
        SLS_DEBUG: '*',
      });
    }
    await LernaHelper.runCommand('deploy', services, region, 1);
    restoreYaml(services);
    } catch { restoreYam }

  }

  private static async _servicesWithCustomDomain(): Promise<ILernaPackage[]> {
    const lerna = new LernaHelper();
    const services = await lerna.getServices();
    return services.filter((service) => LernaHelper.hasCustomDomain(service));
  }
}
*/
