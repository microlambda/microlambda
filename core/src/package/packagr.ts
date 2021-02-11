import { join, relative } from 'path';
import { command } from 'execa';
import { existsSync, mkdirSync, removeSync, statSync } from 'fs-extra';
import { createWriteStream } from 'fs';
import archiver from 'archiver';
import chalk from 'chalk';
import { sync as glob } from 'glob';
import { ILogger, Logger } from '../logger';
import { DependenciesGraph, Service } from '../graph';

/**
 * TODO: Use in memory FS to change node_modules and package.
 * This would allow multiple concurrent package process to be run.
 */


export interface IPackage {
  name: string;
  version: string;
  path: string;
  children: IPackage[];
  parent: IPackage;
  local: boolean;
  duplicate?: boolean;
}

type RawTree = IRawPackage;

type RawDependencies = {
  [packageName: string]: IRawPackage;
};

interface IRawPackage {
  name: string;
  version: string;
  missing?: boolean;
  link?: string;
  path: string;
  dependencies: RawDependencies;
}

export type Tree = IPackage[];

export class Packager {
  private readonly _tree: Map<string, Tree>;
  private readonly _shaken: Map<string, boolean>;
  private readonly _services: Service[];
  private readonly _graph: DependenciesGraph;
  private readonly _logger: ILogger | undefined;

  constructor(graph: DependenciesGraph, services: Service[] | Service, logger?: Logger) {
    this._services = Array.isArray(services) ? services : [services];
    this._tree = new Map();
    this._shaken = new Map();
    this._logger = logger?.log('packagr');
    this._graph = graph;
  }

  public getTree(serviceName: string): Tree | undefined {
    return this._tree.get(serviceName);
  }

  // Should only be used for testing purposes
  public setTree(serviceName: string, tree: Tree): void {
    this._tree.set(serviceName, tree);
  }

  public async bundle(restore = true, level = 4, stdio: 'ignore' | 'inherit' = 'ignore'): Promise<void> {
    await Promise.all(this._services.map((service) => this.generateZip(service, level, restore, stdio)));
  }

  public async generateZip(
    service: Service,
    level: number,
    restore: boolean,
    stdio: 'ignore' | 'inherit',
  ): Promise<number> {
    this._logger?.info(
      `${chalk.bold(service.getName())}: re-installing only workspace production dependencies with yarn`,
    );
    await command(`yarn workspaces focus ${service.getName()} --production`, {
      stdio,
    });
    const projectRoot = this._graph.project.cwd;

    const packageDirectory = join(service.getLocation(), '.package');
    if (existsSync(packageDirectory)) {
      removeSync(packageDirectory);
    }
    mkdirSync(packageDirectory);

    const megabytes = await new Promise<number>((resolve, reject) => {
      const zipName = 'bundle.zip';

      const output = createWriteStream(join(packageDirectory, zipName));

      const archive = archiver('zip', {
        zlib: { level }, // Sets the compression level.
      });

      output.on('close', () => {
        const megabytes = Math.round(100 * (archive.pointer() / 1000000)) / 100;
        this._logger?.info(`${chalk.bold(service.getName())}: Zip files successfully created (${megabytes}MB)`);
        return resolve(megabytes);
      });

      archive.on('warning', (err) => {
        if (err.code === 'ENOENT') {
          this._logger?.warn(err);
        } else {
          this._logger?.error(err);
          return reject(err);
        }
      });

      archive.on('error', (err) => {
        this._logger?.error(err);
        return reject(err);
      });

      archive.pipe(output);

      const lib = join(service.getLocation(), 'lib');

      const toZip: Map<string, string> = new Map();
      // Copy dependencies
      const dependencies = glob(join(projectRoot, 'node_modules', '**', '*'), {
        follow: true,
      });

      dependencies.forEach((path) => {
        toZip.set(relative(projectRoot, path), path);
      });

      // Also package compiled service sources
      const compiledSources = glob(join(lib, '**', '*.js'));
      compiledSources.forEach((js) => {
        toZip.set(relative(lib, js), js);
      });

      // Apply correct permissions to compressed files
      toZip.forEach((from, dest) => {
        const stats = statSync(from);
        if (stats.isFile()) {
          archive.file(from, {
            name: dest,
            mode: 0o644,
          });
        }
      });
      archive.finalize();
    });
    if (restore) {
      await command('yarn install', { stdio });
    }
    return megabytes;
  }

  public print(service: Service, printDuplicates = false): string {
    if (!this._tree) {
      this._logger?.debug(this._tree);
    }
    let printable = '';
    const tree = this._tree.get(service.getName());
    const roots = tree ? tree.filter((p) => p.parent == null) : [];
    const printLevel = (packages: Tree, depth = 0): void => {
      for (const pkg of packages) {
        if (printDuplicates || !pkg.duplicate) {
          printable += `${'-'.repeat(depth)}${pkg.name}@${pkg.version} [${
            pkg.local ? chalk.blue('local') : chalk.yellow('remote')
          }] ${pkg.duplicate ? chalk.red('dedup') : ''}\n`;
        }
        printLevel(pkg.children, depth + 1);
      }
    };
    printLevel(roots);
    return printable;
  }
}
