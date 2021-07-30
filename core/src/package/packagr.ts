import { convertPath, PortablePath, ppath } from '@yarnpkg/fslib/lib/path';
import { getPluginConfiguration, openWorkspace } from '@yarnpkg/cli';
import { Configuration, Project, Workspace } from '@yarnpkg/core';
import { getProjectRoot } from '../get-project-root';
import { getName } from '../yarn/project';
import { dirname, join, relative } from 'path';
import { copy, copyFile, mkdirp, pathExists, readJSONSync, remove, statSync, writeJSONSync } from 'fs-extra';
import { getTsConfig } from '../typescript';
import { createWriteStream } from 'fs';
import archiver from 'archiver';
import { sync as glob } from 'glob';
import { Observable } from 'rxjs';
import { Service } from '../graph';
import { ILogger, Logger } from '../logger';
import { command } from 'execa';

export class Packager {
  private readonly _projectRoot: string;
  private _packagePath: string | undefined;
  private _tmpPath: string | undefined;
  private _logger: ILogger;

  constructor() {
    this._logger = new Logger().log('packagr');
    this._projectRoot = getProjectRoot();
    this._logger.debug('Initialized packagr on project', this._projectRoot);
  }

  static readMetadata(service: Service): { took: number; megabytes: number } {
    try {
      return readJSONSync(join(service.getLocation(), '.package', 'bundle-metadata.json'));
    } catch (e) {
      return { took: 0, megabytes: 0 };
    }
  }

  bundle(service: string, level = 4): Observable<IPackageEvent> {
    return new Observable<IPackageEvent>((obs) => {
      this._logger.debug('Requested to package service', service, '(compression level', level, ')');
      const pkg = async (): Promise<void> => {
        const started = Date.now();
        let now = Date.now();
        this._logger.debug('Analysing yarn workspaces...');
        const originalProject = await this._getOriginalYarnProject();
        this._logger.debug('Found', originalProject.workspaces.length, 'workspaces');
        this._logger.debug('Workspaces:', originalProject.workspaces.map((w) => getName(w)));
        const toPackageOriginal = originalProject.workspaces.find((w) => getName(w) === service);
        if (!toPackageOriginal) {
          throw new Error(
            `Cannot package service ${service}. This service does not exist in current project. Make sure project is initialized with yarn install`,
          );
        }
        this._logger.debug('Creating transient project...');
        const transientProject = await this._createTransientProject(originalProject, toPackageOriginal);
        this._logger.debug('Focusing workspace', getName(toPackageOriginal), '...');
        const dependentWorkspaces = this._focusWorkspace(transientProject, toPackageOriginal);
        this._logger.debug('Copying compiled code of dependent workspaces');
        await this._copyCompiledFiles(originalProject, dependentWorkspaces);
        obs.next({ message: 'Transient project created', took: Date.now() - now });
        now = Date.now();
        this._logger.debug('Running yarn install on patched transient project...')
        await this._yarnInstall(transientProject);
        obs.next({ message: 'Dependencies resolved', took: Date.now() - now });
        now = Date.now();
        this._logger.debug('Generating zip file...');
        const megabytes = await this._generateZip(toPackageOriginal, level);
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

  private async _getOriginalYarnProject(): Promise<Project> {
    const rootPath = convertPath<PortablePath>(ppath, this._projectRoot);
    const plugins = getPluginConfiguration();
    const configuration = await Configuration.find(rootPath, plugins);
    const mainWorkspace = await openWorkspace(configuration, rootPath);
    return mainWorkspace.project;
  }

  private async _createTransientProject(originalProject: Project, toPackage: Workspace): Promise<Project> {
    this._packagePath = join(toPackage.cwd, '.package');
    this._tmpPath = join(this._packagePath, 'tmp');
    this._logger.debug('Creating transient project in', this._tmpPath);
    const packagePathExists = await pathExists(this._tmpPath);
    if (packagePathExists) {
      this._logger.debug('Temporary path already exists, removing it');
      await remove(this._tmpPath);
    }
    await mkdirp(this._tmpPath);
    this._logger.debug('Temporary directory successfully created');
    const manifests = originalProject.workspaces.map((w) => join(w.cwd, 'package.json'));
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
    this._logger.debug(join(this._projectRoot, '.yarnrc.yml'), '->',join(this._tmpPath, '.yarnrc.yml'));
    this._logger.debug(join(this._projectRoot, '.yarn'), '->', join(this._tmpPath, '.yarn'));
    this._logger.debug(join(this._projectRoot, 'yarn.lock'), '->', join(this._tmpPath, 'yarn.lock'));
    await copyFile(join(this._projectRoot, '.yarnrc.yml'), join(this._tmpPath, '.yarnrc.yml'));
    await copy(join(this._projectRoot, '.yarn'), join(this._tmpPath, '.yarn'));
    await copy(join(this._projectRoot, 'yarn.lock'), join(this._tmpPath, 'yarn.lock'));

    // Get transient yarn project
    this._logger.debug('Verifying transient project...');
    const backupDir = process.cwd();
    process.chdir(this._tmpPath);
    this._logger.debug('Current directory updated', process.cwd());
    const portablePackagePath = convertPath<PortablePath>(ppath, this._tmpPath);
    const plugins = getPluginConfiguration();
    const transientConfiguration = await Configuration.find(portablePackagePath, plugins);
    const transientMainWorkspace = await openWorkspace(transientConfiguration, portablePackagePath);
    const transientProject = transientMainWorkspace.project;
    process.chdir(backupDir);
    this._logger.debug('Current directory restored', process.cwd());
    this._logger.debug('Transient project workspaces', transientProject.workspaces.map((w) => getName(w)));
    return transientProject;
  }

  private _focusWorkspace(transientProject: Project, toFocus: Workspace): Array<Workspace> {
    const toPackageTransient = transientProject.workspaces.find(
      (w) => w?.manifest?.name?.identHash === toFocus?.manifest?.name?.identHash,
    );
    if (!toPackageTransient) {
      throw new Error(`Assertion failed: Cannot package workspace ${toFocus} in transient project`);
    }
    this._logger.debug('Find dependencies of workspace to focus', getName(toFocus));
    const requiredWorkspaces: Set<Workspace> = new Set([toPackageTransient]);
    const addWorkspacesDependencies = (workspace: Workspace): void => {
      for (const dep of workspace.manifest.dependencies.values()) {
        const internalDependency = transientProject.workspaces.find(
          (w) => w?.manifest?.name?.identHash === dep.identHash,
        );
        if (internalDependency) {
          requiredWorkspaces.add(internalDependency);
          addWorkspacesDependencies(internalDependency);
        }
      }
    };
    addWorkspacesDependencies(toPackageTransient);
    this._logger.debug('Dependencies workspaces', Array.from(requiredWorkspaces).map((w) => getName(w)));
    const isRequired = (workspace: Workspace): boolean =>
      Array.from(requiredWorkspaces).some((w) => w?.manifest?.name?.identHash === workspace?.manifest?.name?.identHash);
    this._logger.debug('Patching manifests')
    for (const workspace of transientProject.workspaces) {
      if (isRequired(workspace)) {
        this._logger.debug(getName(workspace), 'is dependency of', getName(toPackageTransient), 'removing only devDeps');
        workspace.manifest.devDependencies.clear();
      } else {
        this._logger.debug(getName(workspace), 'is not dependency of', getName(toPackageTransient), 'removing all dependencies');
        workspace.manifest.dependencies.clear();
        workspace.manifest.devDependencies.clear();
        workspace.manifest.peerDependencies.clear();
        workspace.manifest.scripts.clear();
      }
    }
    return Array.from(requiredWorkspaces);
  }

  private async _copyCompiledFiles(originalProject: Project, workspaces: Workspace[]): Promise<void> {
    await Promise.all(
      workspaces.map(async (w) => {
        this._logger.debug('Copying compiled files of', getName(w));
        const originalWorkspace = originalProject.workspaces.find(
          (ow) => ow?.manifest?.name?.identHash === w?.manifest?.name?.identHash,
        );
        if (!originalWorkspace) {
          throw new Error(`Assertion failed: originalWorkspace not found`);
        }
        const config = getTsConfig(originalWorkspace.cwd);
        this._logger.debug('outDir resolved', config?.options?.outDir);
        if (!config?.options?.outDir) {
          throw new Error(
            `Out directory could be resolve for ${getName(
              originalWorkspace,
            )}. Make sure a valid tsconfig.json can be found at package root with a specified outDir`,
          );
        }
        this._logger.debug('Copying', config.options.outDir, '->', join(w.cwd, relative(originalWorkspace.cwd, config.options.outDir)))
        await copy(config.options.outDir, join(w.cwd, relative(originalWorkspace.cwd, config.options.outDir)));
      }),
    );
  }

  private async _yarnInstall(project: Project): Promise<void> {
    try {
      await command('yarn install', {
        cwd: project.cwd,
        stdio: process.env.MILA_DEBUG?.split(',').includes('packagr') ? 'inherit' : 'pipe',
      });
    } catch (e) {
      this._logger.error(e);
      throw Error('Yarn install failed in transient project');
    }
  }

  private async _generateZip(toPackageOriginal: Workspace, level: number): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      if (!this._packagePath) {
        throw new Error('Assertion failed: package path should have been resolved');
      }
      if (!this._tmpPath) {
        throw new Error('Assertion failed: temporary path should have been resolved');
      }
      const zipName = 'bundle.zip';
      const output = createWriteStream(join(this._packagePath, zipName));
      this._logger.debug('Opening write stream on', join(this._packagePath, zipName));
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

      const tsConfig = getTsConfig(toPackageOriginal.cwd);
      const lib = tsConfig?.options?.outDir;
      if (!lib) {
        throw new Error(
          `Out directory could be resolve for ${getName(
            toPackageOriginal,
          )}. Make sure a valid tsconfig.json can be found at package root with a specified outDir`,
        );
      }
      const toZip: Map<string, string> = new Map();

      // Copy dependencies
      this._logger.debug('Copying node_modules');
      const dependencies = glob(join(this._tmpPath, 'node_modules', '**', '*'), {
        follow: true,
      });
      dependencies.forEach((path) => {
        this._logger.debug(relative(String(this._tmpPath), path), '->', path);
        toZip.set(relative(String(this._tmpPath), path), path);
      });

      this._logger.debug('Copying service to package compiled code. outDir =', lib);

      // Also package compiled service sources
      const compiledSources = glob(join(lib, '**', '*.js'));
      compiledSources.forEach((js) => {
        this._logger.debug(relative(lib, js), '->', js)
        toZip.set(relative(lib, js), js);
      });

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
