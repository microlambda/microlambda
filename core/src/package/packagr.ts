import { convertPath, PortablePath, ppath } from '@yarnpkg/fslib/lib/path';
import { getPluginConfiguration, openWorkspace } from '@yarnpkg/cli';
import { Configuration, LightReport, Project, Workspace, Cache } from '@yarnpkg/core';
import { getProjectRoot } from '../get-project-root';
import { getName } from '../yarn/project';
import { dirname, join, relative } from 'path';
import { copyFile, mkdirp, pathExists, copy, remove, statSync } from 'fs-extra';
import { getTsConfig } from '../typescript';
import { createWriteStream } from 'fs';
import archiver from 'archiver';
import { sync as glob } from 'glob';
import { Observable } from 'rxjs';

export class Packager {
  private readonly _projectRoot: string;
  private _packagePath: string | undefined;
  private _tmpPath: string | undefined;

  constructor() {
    this._projectRoot = getProjectRoot();
  }

  bundle(service: string, level = 4): Observable<IPackageEvent> {
    return new Observable<IPackageEvent>((obs) => {
      const pkg = async (): Promise<void> => {
        const started = Date.now();
        let now = Date.now();
        const originalProject = await this._getOriginalYarnProject();
        const toPackageOriginal = originalProject.workspaces.find((w) => getName(w) === service);
        if (!toPackageOriginal) {
          throw new Error(
            `Cannot package service ${service}. This service does not exist in current project. Make sure project is initialized with yarn install`,
          );
        }
        const transientProject = await this._createTransientProject(originalProject, toPackageOriginal);
        const dependentWorkspaces = this._focusWorkspace(transientProject, toPackageOriginal);
        await this._copyCompiledFiles(originalProject, dependentWorkspaces);
        obs.next({ message: 'Transient project created', took: Date.now() - now });
        now = Date.now();
        await this._yarnInstall(transientProject);
        obs.next({ message: 'Dependencies resolved', took: Date.now() - now });
        now = Date.now();
        const megabytes = await this._generateZip(toPackageOriginal, level);
        obs.next({ message: 'Zip file generated', took: Date.now() - now, megabytes, overall: Date.now() - started });
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
    const packagePathExists = await pathExists(this._tmpPath);
    if (packagePathExists) {
      await remove(this._tmpPath);
    }
    await mkdirp(this._tmpPath);
    const manifests = originalProject.workspaces.map((w) => join(w.cwd, 'package.json'));
    await Promise.all(
      manifests.map(async (path) => {
        const dest = join(String(this._tmpPath), relative(this._projectRoot, path));
        const targetDir = dirname(dest);
        const exists = await pathExists(targetDir);
        if (!exists) {
          await mkdirp(targetDir);
        }
        await copyFile(path, dest);
      }),
    );
    await copyFile(join(this._projectRoot, '.yarnrc.yml'), join(this._tmpPath, '.yarnrc.yml'));
    await copy(join(this._projectRoot, '.yarn'), join(this._tmpPath, '.yarn'));
    await copy(join(this._projectRoot, 'yarn.lock'), join(this._tmpPath, 'yarn.lock'));

    // Get transient yarn project
    const backupDir = process.cwd();
    process.chdir(this._tmpPath);
    const portablePackagePath = convertPath<PortablePath>(ppath, this._tmpPath);
    const plugins = getPluginConfiguration();
    const transientConfiguration = await Configuration.find(portablePackagePath, plugins);
    const transientMainWorkspace = await openWorkspace(transientConfiguration, portablePackagePath);
    const transientProject = transientMainWorkspace.project;
    process.chdir(backupDir);
    return transientProject;
  }

  private _focusWorkspace(transientProject: Project, toFocus: Workspace): Array<Workspace> {
    const toPackageTransient = transientProject.workspaces.find(
      (w) => w?.manifest?.name?.identHash === toFocus?.manifest?.name?.identHash,
    );
    if (!toPackageTransient) {
      throw new Error(`Assertion failed: Cannot package workspace ${toFocus} in transient project`);
    }
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
    const isRequired = (workspace: Workspace): boolean =>
      Array.from(requiredWorkspaces).some((w) => w?.manifest?.name?.identHash === workspace?.manifest?.name?.identHash);
    for (const workspace of transientProject.workspaces) {
      if (isRequired(workspace)) {
        workspace.manifest.devDependencies.clear();
      } else {
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
        const originalWorkspace = originalProject.workspaces.find(
          (ow) => ow?.manifest?.name?.identHash === w?.manifest?.name?.identHash,
        );
        if (!originalWorkspace) {
          throw new Error(`Assertion failed: originalWorkspace not found`);
        }
        const config = getTsConfig(originalWorkspace.cwd);
        if (!config?.options?.outDir) {
          throw new Error(
            `Out directory could be resolve for ${getName(
              originalWorkspace,
            )}. Make sure a valid tsconfig.json can be found at package root with a specified outDir`,
          );
        }
        await copy(config.options.outDir, join(w.cwd, relative(originalWorkspace.cwd, config.options.outDir)));
      }),
    );
  }

  private async _yarnInstall(project: Project): Promise<void> {
    const cache = await Cache.find(project.configuration);
    await LightReport.start(
      {
        configuration: project.configuration,
        stdout: process.stdout,
      },
      async (report: LightReport) => {
        await project.install({ cache, report, persistProject: false, lockfileOnly: false });
      },
    );
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
      const dependencies = glob(join(this._tmpPath, 'node_modules', '**', '*'), {
        follow: true,
      });
      dependencies.forEach((path) => {
        toZip.set(relative(String(this._tmpPath), path), path);
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
  }
}
