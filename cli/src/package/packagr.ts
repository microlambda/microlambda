/* eslint-disable no-console */
import { spawn } from 'child_process';
import { join, relative } from 'path';
import { chmodSync, existsSync, mkdirSync, removeSync, statSync } from 'fs-extra';
import { createWriteStream } from 'fs';
import archiver from 'archiver';
import chalk from 'chalk';
import { sync as glob } from 'glob';
import { ILernaPackage, LernaHelper } from '../utils/lerna';

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
  private readonly _services: string[];

  constructor(services?: string[]) {
    this._services = services;
    this._tree = new Map();
    this._shaken = new Map();
  }

  public getTree(serviceName: string): Tree {
    return this._tree.get(serviceName);
  }

  // Should only be used for testing purposes
  public setTree(serviceName: string, tree: Tree): void {
    this._tree.set(serviceName, tree);
  }

  public async bundle(level = 4): Promise<void> {
    const lerna = new LernaHelper();
    const allServices = await lerna.getServices();
    const unknownServices = this._services
      ? this._services.filter((name) => !allServices.some((s) => s.name === name))
      : [];
    if (unknownServices.length) {
      console.error('Unknown services', unknownServices);
      throw Error('E_UNKNOWN_SERVICES');
    }
    const toPackage = this._services != null ? allServices.filter((s) => this._services.includes(s.name)) : allServices;
    await Promise.all(toPackage.map((service) => this.generateZip(service, level)));
  }

  public async generateZip(service: ILernaPackage, level: number): Promise<void> {
    if (!this._tree.has(service.name)) {
      await this.buildDependenciesTree(service);
    }
    if (!this._shaken.has(service.name)) {
      this.shake(service);
    }
    console.info(`${chalk.bold(service.name)}: Dependency tree built and shaken: \n${this.print(service)}`);
    const packageDirectory = join(service.location, '.package');
    if (existsSync(packageDirectory)) {
      removeSync(packageDirectory);
    }
    mkdirSync(packageDirectory);

    return new Promise<void>((resolve, reject) => {
      const zipName = 'bundle.zip';

      const output = createWriteStream(join(packageDirectory, zipName));

      const archive = archiver('zip', {
        zlib: { level }, // Sets the compression level.
      });

      output.on('close', () => {
        console.info(
          `${chalk.bold(service.name)}: Zip files successfully created (${Math.round(
            100 * (archive.pointer() / 1000000),
          ) / 100}MB)`,
        );
        return resolve();
      });

      archive.on('warning', (err) => {
        if (err.code === 'ENOENT') {
          console.warn(err);
        } else {
          console.error(err);
          return reject(err);
        }
      });

      archive.on('error', (err) => {
        console.error(err);
        return reject(err);
      });

      archive.pipe(output);

      const toZip: Map<string, string> = new Map();

      const resolveDestination = (pkg: IPackage, src: string, rootCursor: string, root: string): string => {
        // determine wether this dependency is a direct dependency or another lerna package dependency
        const isLernaDescendent = service.location !== root;
        if (pkg.name === '@dataportal/shared') {
          console.log(service.location, root);
        }
        // If it is "direct dependency" just use the same relative path from service root
        if (!isLernaDescendent) {
          return relative(service.location, src);
        }

        // eg: root /path/to/project/packages/shared/
        // eg: src /path/to/project/packages/shared/node_modules/foo/lib/bar.js
        const relativePath = relative(root, src);
        // eg: relativePath ./node_modules/foo/lib/bar.js
        // eg: cursor ./node_modules/@project/permissions/node_modules/@project/middleware/node_modules/@project/shared
        if (pkg.name === '@dataportal/shared') {
          console.log({ rootCursor, relativePath, dest: join(rootCursor, relativePath) });
        }
        return join(rootCursor, relativePath);
        // eg: dest ./node_modules/@project/permissions/node_modules/@project/middleware/node_modules/@project/shared/node_modules/foo/lib/bar.js
      };

      const copyDependencies = (packages: Tree, cursor: string, root: string, rootCursor: string): void => {
        for (const pkg of packages) {
          if (!pkg.duplicate) {
            // We enter in a new node of the dependency tree, update cursor to reflect position in the tree
            // Do not modify inplace the sursors and root as we are looping, keep the parent infos for other siblings
            const newCursor = join(cursor, 'node_modules', pkg.name);

            // Check if it is lerna symlinked package
            const isLerna = pkg.local;

            // Find all dependencies files expect node_modules
            const files = glob(join(pkg.path, '**', '*')).filter(
              (path) => !relative(pkg.path, path).includes('node_modules'),
            );

            if (pkg.name === '@dataportal/shared') {
              console.log({ newCursor, root, isLerna });
              console.log(files);
            }

            // If it is a lerna package update the cursor and root
            // Root cursor represent to position of the last lerna root in tree, keep it to resolve
            // destination path
            const newRoot = !isLerna ? root : pkg.path;
            const newRootCursor = !isLerna ? rootCursor : newCursor;

            if (pkg.name === '@dataportal/shared') {
              console.log({ newRoot, newRootCursor, isLerna });
            }

            // Resolve file destination in archive and add it to copy queue
            files.forEach((src) => toZip.set(resolveDestination(pkg, src, newRootCursor, newRoot), src));
            // Next recursion step for current package chidlren. Cursor and root are updated.
            if (pkg.children.length > 0) {
              copyDependencies(pkg.children, newCursor, newRoot, newRootCursor);
            }
          }
        }
      };
      const roots = this._tree.get(service.name).filter((p) => p.parent == null);
      copyDependencies(roots, '', service.location, '');

      // Also package compiled service sources
      const lib = join(service.location, 'lib');
      const compiledSources = glob(join(lib, '**', '*.js'));
      compiledSources.forEach((js) => {
        toZip.set(relative(lib, js), js);
      });

      // Apply correct permissions to compressed files
      toZip.forEach((from, dest) => {
        if (statSync(from).isDirectory()) {
          chmodSync(from, 0o755);
        } else if (statSync(from).isFile()) {
          chmodSync(from, 0o644);
          archive.file(from, {
            name: dest,
          });
        }
      });
      archive.finalize();
    });
  }

  public static async getDependenciesTreeFromNPM(cwd: string): Promise<RawTree> {
    return new Promise<RawTree>((resolve) => {
      const process = spawn('npm', ['ls', '--json', '--long', '--prod'], {
        cwd,
      });
      const chunks: Buffer[] = [];
      process.stdout.on('data', (data) => chunks.push(data));
      process.on('close', () => {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      });
    });
  }

  public async buildDependenciesTree(service: ILernaPackage): Promise<Tree> {
    const tree: Tree = [];
    const lerna = new LernaHelper();
    const internals = await lerna.getAllPackages(service.location);
    const rawTree = await Packager.getDependenciesTreeFromNPM(service.location);
    const buildTree = async (deps: RawDependencies, parent?: IPackage): Promise<void> => {
      if (!deps) {
        return;
      }
      for (const name of Object.keys(deps)) {
        const dep = deps[name];
        let pkg: IPackage;
        if (dep.missing) {
          const internal = internals.find((p) => p.name === name);
          if (!internal) {
            console.error('Missing dependency', name);
            throw Error('Missing dependency');
          }
          pkg = {
            name: internal.name,
            version: internal.version,
            path: internal.location,
            children: [],
            parent,
            local: true,
          };
        } else {
          pkg = {
            name: name,
            version: dep.version || 'missing',
            path: dep.link || dep.path,
            children: [],
            parent,
            local: dep.link != null,
          };
        }
        tree.push(pkg);
        if (parent) {
          parent.children.push(pkg);
        }
        if (pkg.local) {
          const linkedDeps = await Packager.getDependenciesTreeFromNPM(pkg.path);
          await buildTree(linkedDeps.dependencies, pkg);
        } else {
          await buildTree(dep.dependencies, pkg);
        }
      }
    };
    await buildTree(rawTree.dependencies);
    this._tree.set(service.name, tree);
    return tree;
  }

  public shake(service: ILernaPackage): Tree {
    const areEquals = (p1: IPackage, p2: IPackage): boolean => {
      return p1.name === p2.name && p1.version === p2.version;
    };
    const roots = this._tree.get(service.name).filter((p) => p.parent == null);
    const leaves = this._tree.get(service.name).filter((p) => p.children.length == 0);

    const alreadyAnalyzed: Set<IPackage> = new Set();
    // From leaves to roots we analyze each package and check whether or not it is a duplicate
    const deduplicate = (deps: IPackage[]): void => {
      // Iterate over package of a level (siblings)
      for (const dep of deps) {
        // Package is duplicate if some upper level node has a sibling with same name and version
        if (!alreadyAnalyzed.has(dep)) {
          const isDuplicate = (pkg: IPackage): boolean => {
            // Get package siblings (uncles)
            const getSiblings = (): IPackage[] => {
              // If package have, siblings are all children of his parent except himself
              if (pkg.parent) {
                return pkg.parent.children;
              }
              // When we are to root package check his brothers
              return roots;
            };
            const siblings = getSiblings();
            // If one of the siblings is equal to lower-level package, lower-level package can be deduplicated
            if (siblings.some((u) => areEquals(u, dep))) {
              return true;
            }
            // Break condition:
            // If nodes has no parent, we reach root nodes, so package is not a duplicate
            return pkg.parent ? isDuplicate(pkg.parent) : false;
          };
          dep.duplicate = dep.parent ? isDuplicate(dep.parent) : false;
          const hasGrandpa = dep.parent && dep.parent.parent;
          // Break condition:
          // Upper level nodes (i.e. father and uncles, i.e. children of grandpa) are root nodes
          if (hasGrandpa) {
            deduplicate(dep.parent.parent.children);
          }
          alreadyAnalyzed.add(dep);
        }
      }
    };
    deduplicate(leaves);

    // If a node has been tagged as duplicate, all his children are also duplicated
    const deduplicateChildren = (deps: IPackage[]): void => {
      for (const dep of deps) {
        if (dep.parent && dep.parent.duplicate) {
          dep.duplicate = dep.parent.duplicate;
        }
        deduplicateChildren(dep.children);
      }
    };
    deduplicateChildren(roots);
    this._shaken.set(service.name, true);
    return this._tree.get(service.name);
  }

  public print(service: ILernaPackage, printDuplicates = false): string {
    if (!this._tree) {
      console.log(this._tree);
    }
    let printable = '';
    const roots = this._tree.get(service.name).filter((p) => p.parent == null);
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
