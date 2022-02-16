import { dirname, join, relative } from 'path';
import { copy, copyFile, mkdirp, pathExists, readJSONSync, remove, statSync, writeJSONSync } from 'fs-extra';
import { getTsConfig } from '../typescript';
import { createWriteStream } from 'fs';
import archiver from 'archiver';
import { sync as glob } from 'glob';
import { Observable } from 'rxjs';
import { ILogger, Logger } from '../logger';
import { command } from 'execa';
import {resloveProjectRoot, Workspace as CentipodWorkspace} from "@centipod/core";
import { Workspace } from '../graph/workspace';
import { Project } from '../graph/project';

export class Packager {
  private readonly _projectRoot: string;
  private _packagePath: string | undefined;
  private _tmpPath: string | undefined;
  private _logger: ILogger;

  constructor(private readonly _useLayers = false, private readonly _buildLayer = true) {
    this._logger = new Logger().log('packagr');
    this._projectRoot = resloveProjectRoot();
    this._logger.debug('Initialized packagr on project', this._projectRoot);
  }

  static readMetadata(service: CentipodWorkspace): { took: number; megabytes: { code: number; layer?: number } } {
    try {
      return readJSONSync(join(service.root, '.package', 'bundle-metadata.json'));
    } catch (e) {
      return { took: 0, megabytes: { code: 0 } };
    }
  }

  bundle(service: string, level = 4): Observable<IPackageEvent> {
    return new Observable<IPackageEvent>((obs) => {
      this._logger.debug('Requested to package service', service, '(compression level', level, ')');
      const pkg = async (): Promise<void> => {
        const started = Date.now();
        const shouldResolvesServiceNodeModules = !this._useLayers || this._buildLayer;
        let now = Date.now();
        this._logger.debug('Analysing yarn workspaces...');
        const originalProject = await Project.loadProject(this._projectRoot);
        this._logger.debug('Found', originalProject.workspaces.size, 'workspaces');
        this._logger.debug(
          'Workspaces:',
          Array.from(originalProject.services.keys()),
        );
        const toPackageOriginal = originalProject.services.get(service);
        if (!toPackageOriginal) {
          throw new Error(
            `Cannot package service ${service}. This service does not exist in current project. Make sure project is initialized with yarn install`,
          );
        }
        this._packagePath = join(toPackageOriginal.root, '.package');
        if (shouldResolvesServiceNodeModules) {
          this._logger.debug('Creating transient project...');
          const transientProject = await this._createTransientProject(originalProject);
          this._logger.debug('Focusing workspace', toPackageOriginal.name, '...');
          const dependentWorkspaces = this._focusWorkspace(transientProject, toPackageOriginal);
          this._logger.debug('Copying compiled code of dependent workspaces');
          await this._copyCompiledFiles(originalProject, dependentWorkspaces);
          obs.next({ message: 'Transient project created', took: Date.now() - now });
          now = Date.now();
          this._logger.debug('Running yarn install on patched transient project...');
          await this._yarnInstall(transientProject);
          obs.next({ message: 'Dependencies resolved', took: Date.now() - now });
          now = Date.now();
        } else {
          await mkdirp(this._packagePath);
        }
        this._logger.debug('Generating zip file...');
        const megabytes = await this._generateArchives(toPackageOriginal, level);
        obs.next({ message: 'Zip file generated', took: Date.now() - now, megabytes, overall: Date.now() - started });
        if (!this._packagePath) {
          throw new Error('Assertion failed: package path should have been resolved');
        }
        writeJSONSync(join(this._packagePath, 'bundle-metadata.json'), { megabytes, took: Date.now() - started });
      };
      pkg()
        .then(() => obs.complete())
        .catch((e) => obs.error(e));
    });
  }

  private async _createTransientProject(originalProject: Project): Promise<Project> {
    if (!this._packagePath) {
      throw new Error('Assertion failed: temporary path should have been resolved');
    }
    this._tmpPath = join(this._packagePath, 'tmp');
    this._logger.debug('Creating transient project in', this._tmpPath);
    const packagePathExists = await pathExists(this._tmpPath);
    if (packagePathExists) {
      this._logger.debug('Temporary path already exists, removing it');
      await remove(this._tmpPath);
    }
    await mkdirp(this._tmpPath);
    this._logger.debug('Temporary directory successfully created');
    const manifests = Array.from(originalProject.workspaces.values())
      .filter((w) => !w.root.includes('/tooling/'))
      .map((w) => join(w.root, 'package.json'));
    await Promise.all(
      manifests.map(async (path) => {
        const dest = join(String(this._tmpPath), relative(this._projectRoot, path));
        const targetDir = dirname(dest);
        const exists = await pathExists(targetDir);
        if (!exists) {
          await mkdirp(targetDir);
        }
        this._logger.debug('Copying workspaces manifests', path, '->', dest);
        await copyFile(path, dest);
      }),
    );
    this._logger.debug('Copying yarn lock, cache and config');
    this._logger.debug(join(this._projectRoot, '.yarnrc.yml'), '->', join(this._tmpPath, '.yarnrc.yml'));
    this._logger.debug(join(this._projectRoot, '.yarn'), '->', join(this._tmpPath, '.yarn'));
    this._logger.debug(join(this._projectRoot, 'yarn.lock'), '->', join(this._tmpPath, 'yarn.lock'));
    await copyFile(join(this._projectRoot, '.yarnrc.yml'), join(this._tmpPath, '.yarnrc.yml'));
    await copy(join(this._projectRoot, 'package.json'), join(this._tmpPath, 'package.json'));
    await copy(join(this._projectRoot, '.yarn'), join(this._tmpPath, '.yarn'));
    await copy(join(this._projectRoot, 'yarn.lock'), join(this._tmpPath, 'yarn.lock'));

    // Get transient yarn project
    this._logger.debug('Verifying transient project...');
    const transientProject = await Project.loadProject(this._tmpPath);
    this._logger.debug(
      'Transient project workspaces',
      transientProject.workspaces.keys(),
    );
    return transientProject;
  }

  private _focusWorkspace(transientProject: Project, toFocus: Workspace): Array<CentipodWorkspace> {
    const toPackageTransient = transientProject.workspaces.get(toFocus.name);
    if (!toPackageTransient) {
      throw new Error(`Assertion failed: Cannot package workspace ${toFocus} in transient project`);
    }
    const manifest = readJSONSync(join(transientProject.root, 'package.json'));
    delete manifest.devDependencies;
    writeJSONSync(join(transientProject.root, 'package.json'), manifest, { spaces: 2 });
    this._logger.debug('Find dependencies of workspace to focus', toFocus.name);
    const requiredWorkspaces: Set<CentipodWorkspace> = new Set([toPackageTransient]);
    const addWorkspacesDependencies = (workspace: CentipodWorkspace): void => {
      for (const dep of workspace.dependencies()) {
        const internalDependency = transientProject.workspaces.get(dep.name);
        if (internalDependency) {
          requiredWorkspaces.add(internalDependency);
          addWorkspacesDependencies(internalDependency);
        }
      }
    };
    addWorkspacesDependencies(toPackageTransient);
    this._logger.debug(
      'Dependencies workspaces',
      Array.from(requiredWorkspaces).map((w) => w.name),
    );
    const isRequired = (workspace: CentipodWorkspace): boolean =>
      Array.from(requiredWorkspaces).some((w) => w.name === workspace.name);
    this._logger.debug('Patching manifests');
    for (const workspace of transientProject.workspaces.values()) {
      if (isRequired(workspace)) {
        this._logger.debug(
          workspace.name,
          'is dependency of',
          toPackageTransient.name,
          'removing only devDeps',
        );
        const manifest = readJSONSync(join(workspace.root, 'package.json'));
        delete manifest.devDependencies;
        writeJSONSync(join(workspace.root, 'package.json'), manifest, { spaces: 2 });
      } else {
        this._logger.debug(
          workspace.name,
          'is not dependency of',
          toPackageTransient.name,
          'removing all dependencies',
        );
        const manifest = readJSONSync(join(workspace.root, 'package.json'));
        delete manifest.dependencies;
        delete manifest.devDependencies;
        delete manifest.peerDependencies;
        delete manifest.scripts;
        writeJSONSync(join(workspace.root, 'package.json'), manifest, { spaces: 2 });
      }
    }
    return Array.from(requiredWorkspaces);
  }

  private async _copyCompiledFiles(originalProject: Project, workspaces: CentipodWorkspace[]): Promise<void> {
    await Promise.all(
      workspaces.map(async (w) => {
        this._logger.debug('Copying compiled files of', w.name);
        const originalWorkspace = originalProject.workspaces.get(w.name);
        if (!originalWorkspace) {
          throw new Error(`Assertion failed: originalWorkspace not found`);
        }
        const config = getTsConfig(originalWorkspace.root);
        this._logger.debug('outDir resolved', config?.options?.outDir);
        if (!config?.options?.outDir) {
          throw new Error(
            `Out directory could be resolve for ${originalWorkspace.name}. Make sure a valid tsconfig.json can be found at package root with a specified outDir`,
          );
        }
        this._logger.debug(
          'Copying',
          config.options.outDir,
          '->',
          join(w.root, relative(originalWorkspace.root, config.options.outDir)),
        );
        await copy(config.options.outDir, join(w.root, relative(originalWorkspace.root, config.options.outDir)));
      }),
    );
  }

  private async _yarnInstall(project: Project): Promise<void> {
    try {
      await command('yarn install', {
        cwd: project.root,
        stdio: process.env.MILA_DEBUG?.split(',').includes('packagr') ? 'inherit' : 'pipe',
      });
    } catch (e) {
      this._logger.error(e);
      throw Error('Yarn install failed in transient project');
    }
  }

  private async _generateArchives(
    toPackageOriginal: Workspace,
    level: number,
  ): Promise<{ layer?: number; code: number }> {
    const megabytes: { layer?: number; code: number } = {
      code: await this._generateCodeArchive(toPackageOriginal, level),
    };
    if (this._useLayers && this._buildLayer) {
      megabytes.layer = await this._generateLayerArchive(level);
    }
    return megabytes;
  }

  private async _generateLayerArchive(level: number): Promise<number> {
    const layerZipName = 'layer.zip';
    const toZip: Map<string, string> = new Map();
    this._copyDependencies(toZip);
    return this._generateZip(toZip, layerZipName, level);
  }

  private _copyDependencies(toZip: Map<string, string>): void {
    if (!this._tmpPath) {
      throw new Error('Assertion failed: temporary path should have been resolved');
    }
    // Copy dependencies
    this._logger.debug('Copying node_modules');
    const dependencies = glob(join(this._tmpPath, 'node_modules', '**', '*'), {
      follow: true,
    });
    dependencies.forEach((path) => {
      this._logger.debug(relative(String(this._tmpPath), path), '->', path);
      toZip.set(relative(String(this._tmpPath), path), path);
    });
  }

  private _copyCompiledSources(toZip: Map<string, string>, toPackageOriginal: Workspace): void {
    const tsConfig = getTsConfig(toPackageOriginal.root);
    const lib = tsConfig?.options?.outDir;
    if (!lib) {
      throw new Error(
        `Out directory could be resolve for ${toPackageOriginal.name}. Make sure a valid tsconfig.json can be found at package root with a specified outDir`,
      );
    }
    this._logger.debug('Copying service to package compiled code. outDir =', lib);
    // Also package compiled service sources
    const compiledSources = glob(join(lib, '**', '*.js'));
    compiledSources.forEach((js) => {
      this._logger.debug(relative(lib, js), '->', js);
      toZip.set(relative(lib, js), js);
    });
  }

  private async _generateCodeArchive(toPackageOriginal: Workspace, level: number): Promise<number> {
    const zipName = 'bundle.zip';
    const toZip: Map<string, string> = new Map();
    if (!this._useLayers) {
      this._copyDependencies(toZip);
    }
    this._copyCompiledSources(toZip, toPackageOriginal);
    return this._generateZip(toZip, zipName, level);
  }

  private async _generateZip(toZip: Map<string, string>, zipName: string, level: number): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      if (!this._packagePath) {
        throw new Error('Assertion failed: package path should have been resolved');
      }
      this._logger.debug('Opening write stream on', join(this._packagePath, zipName));
      const output = createWriteStream(join(this._packagePath, zipName));
      const archive = archiver('zip', {
        zlib: { level }, // Sets the compression level.
      });

      output.on('close', () => {
        const megabytes = Math.round(100 * (archive.pointer() / 1000000)) / 100;
        return resolve(megabytes);
      });

      archive.on('warning', (err) => {
        if (err.code === 'ENOENT') {
        } else {
          return reject(err);
        }
      });

      archive.on('error', (err) => {
        return reject(err);
      });

      archive.pipe(output);

      // Apply correct permissions to compressed files
      this._logger.debug('Applying correct chmod');
      toZip.forEach((from, dest) => {
        const stats = statSync(from);
        if (stats.isFile()) {
          archive.file(from, {
            name: dest,
            mode: 0o644,
          });
        }
      });
      this._logger.debug('Finalize');
      archive.finalize();
    });
  }
}
