import { spawn } from 'child_process';
import { existsSync } from 'fs-extra';
import { join } from 'path';
import { command, ExecaChildProcess } from 'execa';
import { parseServerlessYaml } from './yaml';

export interface ILernaPackage {
  name: string;
  version: string;
  private: boolean;
  location: string;
}

export class LernaHelper {
  private _packages: ILernaPackage[];

  public static runCommand(
    cmd: string,
    scopes: string[],
    region?: string,
    concurrency = 4,
    env?: { [ket: string]: string },
  ): ExecaChildProcess<string> {
    const args = ['npx', 'lerna', 'run'];
    args.push(...cmd.split(' '));

    scopes.forEach((s) => args.push(`--scope=${s}`));
    args.push('--concurrency');
    args.push(concurrency.toString());
    args.push('--stream');
    if (region) {
      args.push('--');
      args.push('--');
      args.push(`--region=${region}`);
    }
    return command(args.join(' '), {
      env: { ...env, AWS_REGION: region },
      stdio: 'inherit',
    });
  }

  public async getAllPackages(cwd?: string): Promise<ILernaPackage[]> {
    if (this._packages) {
      return this._packages;
    }
    return new Promise<ILernaPackage[]>((resolve) => {
      const process = spawn('npx', ['lerna', 'la', '--json'], {
        cwd,
      });
      const chunks: Buffer[] = [];
      process.stdout.on('data', (data) => chunks.push(data));
      process.on('close', () => {
        this._packages = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        resolve(this._packages);
      });
    });
  }

  public async getServices(cwd?: string): Promise<ILernaPackage[]> {
    const packages = await this.getAllPackages(cwd);
    return packages.filter((p) => {
      const hasYml = existsSync(join(p.location, 'serverless.yml'));
      const hasYaml = existsSync(join(p.location, 'serverless.yaml'));
      return hasYml || hasYaml;
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static _readServiceYaml(service: ILernaPackage): any {
    const hasYml = existsSync(join(service.location, 'serverless.yml'));
    const hasYaml = existsSync(join(service.location, 'serverless.yaml'));
    if (!hasYaml && !hasYml) {
      throw Error(`${service} is not a valid service`);
    }
    return parseServerlessYaml(join(service.location, 'serverless.' + (hasYaml ? 'yaml' : 'yml')));
  }

  public static hasCustomDomain(service: ILernaPackage): boolean {
    const yaml = LernaHelper._readServiceYaml(service);
    return yaml.custom && yaml.custom.customDomain && yaml.custom.customDomain.domainName;
  }

  // FIXME: Stubbed because I spent to much time on this
  // TODO: MVP => Read from config
  /*
    The real solution would be to create a plugin and retrieve teh real value after serverless variables resolution
  */
  public static getCustomDomain(service: string, stage: string): string {
    return stage === 'prod'
      ? `${service.substr(12)}.api-dataportal.pernod-ricard.io`
      : `${service.substr(12)}.${stage}.api-dataportal.pernod-ricard.io`;
  }

  public static getServiceName(service: ILernaPackage): string {
    const yaml = LernaHelper._readServiceYaml(service);
    return yaml.service;
  }
}
