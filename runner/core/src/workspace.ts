// Class
import {Project} from './project';
import {promises as fs} from 'fs';
import {join, relative} from 'path';
import {INpmInfos, Package} from './package';
import {git} from './git';
import {sync as glob} from 'fast-glob';
import { command, ExecaChildProcess, ExecaError, ExecaReturnValue } from "execa";
import {
  CommandResult,
  ICommandResult,
  IDaemonCommandResult,
  IProcessResult,
  isDaemon,
} from "./process";
import {Publish, PublishActions, PublishEvent} from './publish';
import { Observable, race, throwError } from "rxjs";
import {MilaError, MilaErrorCode} from '@microlambda/errors';
import semver from 'semver';
import { catchError, finalize } from "rxjs/operators";
import Timer = NodeJS.Timer;
import { AbstractLogsHandler, ILogsHandler } from "./logs-handler";
import processTree from "ps-tree";
import { isPortAvailable } from "./port-available";
import { EventsLog, EventsLogger } from '@microlambda/logger';
import { ITargetsConfig, ConfigReader, ILogsCondition, ICommandConfig } from '@microlambda/config';
import { LocalCache } from "./cache/local-cache";
import { LocalArtifacts } from './artifacts/local-artifacts';
import { Cache } from './cache/cache';
import { Artifacts } from './artifacts/artifacts';
import { RemoteCache } from './cache/remote-cache';
import { RemoteArtifacts } from './artifacts/remote-artifacts';
import { isUsingRemoteCache, RunOptions } from './runner';
import { checkWorkingDirectoryClean } from './remote-cache-utils';

const TWO_MINUTES = 2 * 60 * 1000;
const DEFAULT_DAEMON_TIMEOUT = TWO_MINUTES;

export class Workspace {
  // Constructor
  constructor(
    readonly pkg: Package,
    readonly root: string,
    readonly _config: { regions?: string[], targets: ITargetsConfig },
    readonly project?: Project,
    readonly eventsLog?: EventsLog,
  ) {
    this._logger = this.eventsLog?.scope('runner-core/workspace');
  }

  private _logger: EventsLogger | undefined;

  // Statics
  static async loadPackage(root: string): Promise<Package> {
    const file = join(root, 'package.json');
    const data = await fs.readFile(file, 'utf-8');
    return JSON.parse(data);
  }

  static async loadWorkspace(root: string, project?: Project, logger?: EventsLog): Promise<Workspace> {
    const pkg = await this.loadPackage(root);
    return new Workspace(pkg, root, await this.loadConfig(pkg.name, root, project), project, logger);
  }

  static async loadConfig(name: string, root: string, project?: Project): Promise<{ regions?: string[], targets: ITargetsConfig }> {
    const configReader = new ConfigReader(project?.root || root);
    if (!project) {
      // Not loading target for root package
      return { targets: {} };
    }
    return configReader.loadPackageConfig(name, root);
  }

  // Methods
  *dependencies(): Generator<Workspace, void> {
    if (!this.project) {
      throw new MilaError(MilaErrorCode.PROJECT_NOT_RESOLVED, `Cannot load dependencies of workspace ${this.name}: loaded outside of a project`)
    }
    // Generate dependencies
    for (const deps of [this.pkg.dependencies, this.pkg.devDependencies]) {
      if (!deps) continue;

      for (const dep of Object.keys(deps)) {
        const wks = this.project.getWorkspace(dep);
        if (wks) yield wks;
      }
    }
  }

  get descendants(): Map<string, Workspace> {
    const descendants = new Map<string, Workspace>();
    const visitWorkspace = (wks: Workspace): void => {
      for (const dep of wks.dependencies()) {
        visitWorkspace(dep);
        descendants.set(dep.name, dep);
      }
    }
    visitWorkspace(this);
    return descendants;
  }

  get ancestors(): Map<string, Workspace> {
    const ancestors = new Map<string, Workspace>();
    if (!this.project) {
      throw new MilaError(MilaErrorCode.PROJECT_NOT_RESOLVED, `Cannot load dependencies of workspace ${this.name}: loaded outside of a project`)
    }
    for (const workspace of this.project.workspaces.values()) {
      if (workspace === this) continue;
      if (workspace.descendants.has(this.name)) ancestors.set(workspace.name, workspace);
    }
    return ancestors;
  }

  // Properties
  get config(): ITargetsConfig {
    return this._config.targets;
  }

  get regions(): string[] | undefined {
    return this._config.regions;
  }

  get name(): string {
    return this.pkg.name;
  }

  get private(): boolean {
    return this.pkg.private === true;
  }

  get version(): string | undefined {
    return this.pkg.version;
  }

  private _publish: Publish | undefined;
  private _npmInfos: INpmInfos | undefined;

  private async _testAffected(rev1: string, rev2?: string, patterns: string[] = ['**']): Promise<boolean> {
    // Compute diff
    const diffs = rev2
      ? await git.diff('--name-only', rev1, rev2, '--', this.root)
      : await git.diff('--name-only', rev1, '--', this.root);

    // No pattern
    if (patterns.length === 0 && patterns[0] === '**') {
      return diffs.length > 0;
    }

    const rel = relative(git.root, this.root);
    const files = patterns.map((pattern) => glob(join(rel, pattern))).reduce((acc, val) => acc = acc.concat(val), []);
    return diffs.some((diff) => files.includes(diff));
  }

  private async _testDepsAffected(tested: Set<Workspace>,rev1: string, rev2?: string, patterns: string[] = ['**']): Promise<boolean> {
    tested.add(this);

    // Test if is affected
    const affected = await this._testAffected(rev1, rev2, patterns);
    if (affected) return true;

    // Test dependencies if are affected
    for (const dep of this.dependencies()) {
      // Check if already tested
      if (tested.has(dep)) continue;

      // Test
      const affected = await dep._testDepsAffected(tested, rev1, rev2, patterns);
      if (affected) return true;
    }

    return false;
  }

  private static async _checkRevision(rev: string): Promise<void> {
    const isValid = await git.revisionExists(rev);
    if (!isValid) {
      throw new MilaError(MilaErrorCode.BAD_REVISION, `Bad revision: ${rev}`);
    }
  }

  private static async _checkRevisions(rev1: string, rev2?: string): Promise<void> {
    await Workspace._checkRevision(rev1);
    if (rev2) {
      await Workspace._checkRevision(rev2);
    }
  }

  async isAffected(rev1: string, rev2?: string, patterns: string[] = ['**'], topological = true): Promise<boolean> {
    await Workspace._checkRevisions(rev1, rev2);
    if (!topological) {
      return await this._testAffected(rev1, rev2, patterns);
    }
    return await this._testDepsAffected(new Set(), rev1, rev2, patterns);
  }

  hasCommand(cmd: string): boolean {
    return !!this.config[cmd];
  }

  private async _handleDaemon<T = string>(
    target: string,
    daemonConfig: ILogsCondition | ILogsCondition[],
    cmdProcess: ExecaChildProcess,
    startedAt: number,
  ): Promise<IDaemonCommandResult> {
    this._logger?.debug('Handling daemon for process', cmdProcess);
    const logsConditions = Array.isArray(daemonConfig) ? daemonConfig : [daemonConfig];
    let killed = false;
    const crashed$ = new Observable<IDaemonCommandResult>((obs) => {
      this._logger?.debug('Watching for daemon crash');
      cmdProcess.catch((crashed) => {
        this._logger?.error(crashed);
        if (!killed) {
          this._handleLogs('append', target,'Daemon crashed');
          this._handleLogs('append', target, crashed.message);
          this._logger?.warn('Daemon crashed', { target: this.name });
          obs.error(crashed);
        }
      });
    });
    this._logger?.info('Verifying logs conditions', { target: this.name });
    const timers: Timer[] = [];
    this._logger?.debug('logsConditions', JSON.stringify(logsConditions));
    const logsConditionsMet$ = logsConditions.map((condition) => new Observable<IDaemonCommandResult>((obs) => {
      this._logger?.debug('Watching for log condition', condition);
      const logStream = cmdProcess[condition.stdio];
      this._logger?.debug(logStream);
      if (!logStream) {
        return obs.error('Log stream not readable, did you try to run a daemon cmd using stdio inherit ?')
      }
      const timeout = condition.timeout || DEFAULT_DAEMON_TIMEOUT;
      const timer = setTimeout(() => obs.error(`Timeout (${timeout}ms) for log condition exceeded`), timeout);
      timers.push(timer);
      logStream.on('data', (chunk: string | Buffer) => {
        this._logger?.debug(`[${this.name}_child_process]`, chunk.toString());
        if (condition.matcher === 'contains' && chunk.toString().includes(condition.value)) {
          this._logger?.info('Condition resolved for', this.name, condition);
          this._logger?.debug('Condition resolved for', this.name, condition);
          clearTimeout(timer);
          if (condition.type === 'success') {
            obs.next({daemon: true, process: cmdProcess, took: Date.now() - startedAt});
            return obs.complete();
          }
          return obs.error(`Log condition explicitly failed : ${JSON.stringify(condition)}`);
        }
      });
    }));

    const race$ = race(...logsConditionsMet$, crashed$).pipe(
      catchError((e) => {
        this._logger?.error('Error happened, killing process', { target: this.name });
        killed = true;
        cmdProcess.kill();
        this._logger?.debug('Rethrow', { target: this.name }, e);
        return throwError(e);
      }),
      finalize(() => {
        this._logger?.info('Flushing timers', { target: this.name });
        timers.forEach((timer) => clearTimeout(timer));
      })
    )
    return new Promise<IDaemonCommandResult>((resolve, reject) => {
      race$.subscribe({ next: resolve, error: reject });
    });
  }

  private _logsHandlers: Map<string, AbstractLogsHandler<unknown>> = new Map();

  logs(name: string): AbstractLogsHandler<unknown> | undefined {
    return this._logsHandlers.get(name);
  }

  addLogsHandler(handler: AbstractLogsHandler<unknown>): void {
    if (this._logsHandlers.has(handler.name)) {
      throw new Error(`Log handler with name ${handler.name} already registered`)
    }
    this._logsHandlers.set(handler.name, handler);
  }

  private _handleLogs(
    action: keyof ILogsHandler,
    target: string,
    arg?: string | (string | Buffer) | (ExecaReturnValue | ExecaError),
  ): void{
    for (const handler of this._logsHandlers.values()) {
      handler[action](target, arg as (string & (string | Buffer)) & (ExecaReturnValue | ExecaError));
    }
  }

  private _processes = new Map<string, Map<string, ExecaChildProcess>>();

  get processes(): Map<string, Map<string, ExecaChildProcess<string>>> {
    return this._processes;
  }

  private static _killProcessTree(childProcess: ExecaChildProcess, signal: 'SIGTERM' | 'SIGKILL' = 'SIGTERM'): void {
    if (childProcess.pid) {
      processTree(childProcess.pid, (err, children) => {
        if (err) {
          childProcess.kill(signal);
        }
        children.forEach((child) => process.kill(Number(child.PID), signal));
      });
    }
  }

  private static async _killProcess(childProcess: ExecaChildProcess, releasePorts: number[] = [], timeout = 500): Promise<void> {
    return new Promise<void>((resolve) => {
      const watchKilled = (): void => {
        if (childProcess) {
          let killed = false;
          childProcess.on('close', () => {
            // On close, we are sure that every process in process tree has exited, so we can complete observable
            // This is the most common scenario, where sls offline gracefully shutdown underlying hapi server and
            // close properly with status 0
            killed = true;
            return resolve();
          });
          // This is a security to make child process release given ports, we give 500ms to process to gracefully
          // exit. Other wise we send SIGKILL to the whole process tree to free the port (#Rampage)
          if (releasePorts) {
            setTimeout(async () => {
              const areAvailable = await Promise.all(releasePorts.map((port) => isPortAvailable(port)));
              if (areAvailable.some((a) => !a) && !killed) {
                this._killProcessTree(childProcess, 'SIGKILL');
              }
              return resolve();
            }, timeout);
          }
        }
      };
      if (childProcess) {
        watchKilled();
        this._killProcessTree(childProcess);
      }
    })

  }

  async kill(cmd: string, releasePorts: number[] = [], timeout = 500): Promise<void> {
    const processes = this._processes.get(cmd);
    if (processes) {
      await Promise.all([...processes.values()].map((cp) => Workspace._killProcess(cp, releasePorts, timeout)));
    }
  }

  private async _runCommand(
    target: string,
    cmd: string | ICommandConfig,
    args?: string,
    env: {[key: string]: string} = {},
    stdio: 'pipe' | 'inherit' = 'pipe',
  ): Promise<CommandResult> {
    const startedAt = Date.now();
    const _cmd = typeof cmd === 'string' ? cmd : cmd.run;
    const _fullCmd = args ? [_cmd, args].join(' ') : _cmd;
    this._logger?.info('Launching process', { cmd: target, target: this.name });
    this._handleLogs('commandStarted', target, _fullCmd);
    const cmdId = _fullCmd + '-' + Date.now();
    const _process = command(_fullCmd, {
      cwd: this.root,
      all: true,
      env: { ...process.env, FORCE_COLOR: '2', ...env },
      shell: process.platform === 'win32',
      stdio,
    });
    if (this._processes.has(target)) {
      this._processes.get(target)?.set(cmdId, _process);
    } else {
      this._processes.set(target, new Map([[cmdId, _process]]));
    }
    this._logger?.info('Process launched', { cmd: target, target: this.name });
    _process.all?.on('data', (chunk) => {
      this._handleLogs('append', target, chunk);
    });
    if (typeof cmd !== 'string' && cmd.daemon) {
      this._logger?.info('Command flagged as daemon', { cmd: target, target: this.name });
      this._logger?.debug('Handling daemon', { cmd: target, target: this.name });
      return this._handleDaemon(target, cmd.daemon, _process, startedAt);
    } else {
      this._logger?.info('Command not flagged as daemon', { cmd: target, target: this.name });
      try {
        const result = await _process;
        this._logger?.info('Command terminated', { cmd: target, target: this.name }, result);
        this._processes.get(target)?.delete(cmdId);
        this._handleLogs('commandEnded', target, result);
        return {...result, took: Date.now() - startedAt, daemon: false };
      } catch (e) {
        if ((e as ExecaError).exitCode) {
          this._handleLogs('commandEnded', target, e as ExecaError);
        }
        throw e;
      }
    }
  }

  private async _runCommands(
    target: string,
    args: string[] | string = [],
    env: {[key: string]: string} = {},
    stdio: 'pipe' | 'inherit' = 'pipe',
  ): Promise<Array<CommandResult>> {
    const results: Array<CommandResult> = [];
    const config = this.config[target];
    const commands = config.cmd;
    const _args = Array.isArray(args) ? args : [args];
    let idx = 0;
    this._handleLogs('open', target);
    for (const _cmd of Array.isArray(commands) ? commands : [commands]) {
      this._logger?.debug('cmd', JSON.stringify(_cmd));
      this._logger?.info('Do run command', { target: this.name, cmd: _cmd, args: _args[idx], env, stdio});
      results.push(await this._runCommand(target, _cmd, _args[idx], env, stdio));
      idx++;
    }
    if (Array.isArray(commands) ? commands : [commands].some((cmd) => typeof cmd !== 'string' && cmd.daemon)) {
      this._handleLogs('close', target);
    }
    this._logger?.info('All commands run', { cmd: target, target: this.name }, results);
    return results;
  }

  private async _runCommandsAndCache(
    cache: Cache | undefined,
    artifacts: Artifacts | undefined,
    target: string,
    args: string[] | string = [],
    env: {[key: string]: string} = {},
    stdio: 'pipe' | 'inherit' = 'pipe',
  ): Promise<IProcessResult> {
    try {
      this._logger?.info('Do run commands', { cmd: target, target: this.name });
      const results = await this._runCommands(target, args, env, stdio);
      try {
        this._logger?.info('All success, caching result', { cmd: target, target: this.name });
        if (cache && artifacts) {
          const toCache: Array<ICommandResult> = results.filter((r) => !isDaemon(r)) as Array<ICommandResult>;
          await cache.write(toCache);
          await artifacts.write();
        }
        this._logger?.info('Successfully cached', { cmd: target, target: this.name });
        this._logger?.debug('Emitting', { cmd: target, target: this.name });
        return { commands: results, fromCache: false, overall: results.reduce((acc, val) => acc + val.took, 0) };
      } catch (e) {
        this._logger?.warn('Error writing cache', { cmd: target, target: this.name });
        this._logger?.debug('Emitting', { cmd: target, target: this.name });
        return { commands: results, fromCache: false, overall: results.reduce((acc, val) => acc + val.took, 0) };
      }
    } catch (e) {
      if (cache) {
        this._logger?.info('Command failed, invalidating cache', { cmd: target, target: this.name });
        try {
          await cache.invalidate();
        } catch (err) {
          this._logger?.error('Error invalidating cache', { cmd: target, target: this.name }, err);
        }
      }
      this._logger?.debug('Rethrowing', { cmd: target, target: this.name });
      throw e;
    }
  }

  private async _run(options: RunOptions): Promise<IProcessResult> {
    const now = Date.now();
    this._logger?.info('Running command', { cmd: options.cmd, workspace: this.name });
    let cache: Cache | undefined;
    let artifacts: Artifacts | undefined;
    if (options.force) {
      this._logger?.info('Using --force option, cache are disabled');
    } else if (isUsingRemoteCache(options) && options.remoteCache) {
      this._logger?.info('Using remote cache', { region: options.remoteCache.region, bucket: options.remoteCache.bucket });
      cache = new RemoteCache(
        options.remoteCache.region,
        options.remoteCache.bucket,
        this,
        options.cmd,
        options.affected,
        options.args,
        options.env,
        this.eventsLog,
        options.cachePrefix,
      );
      artifacts = new RemoteArtifacts(
        options.remoteCache.region,
        options.remoteCache.bucket,
        this,
        options.cmd,
        options.affected,
        options.args,
        options.env,
        this.eventsLog,
        options.cachePrefix,
      );
    } else {
      this._logger?.info('Using local cache');
      cache = new LocalCache(this, options.cmd, options.args, options.env, this.eventsLog);
      artifacts = new LocalArtifacts(this, options.cmd, options.args, options.env, this.eventsLog);
    }
    try {
      if (options.force) {
        this._logger?.info('Option --force used, removing artifacts to run command on a clean state');
        await new LocalArtifacts(this, options.cmd, options.args, options.env, this.eventsLog).removeArtifacts();
      } else {
        const cachedOutputs = await cache?.read();
        if (artifacts instanceof RemoteArtifacts) {
          await artifacts.downloadArtifacts();
        }
        const areArtifactsValid = (await artifacts?.checkArtifacts()) || false;
        this._logger?.debug('Artifacts valid ?', areArtifactsValid);
        this._logger?.info('Cache read', { cmd: options.cmd, target: this.name }, cachedOutputs);
        if (!options.force && cachedOutputs && areArtifactsValid) {
          this._logger?.info('From cache', { cmd: options.cmd, target: this.name });
          this._handleLogs('open', options.cmd);
          cachedOutputs.forEach((output) => {
            this._handleLogs('append', options.cmd, output.command);
            this._handleLogs('append', options.cmd, output.all);
            this._handleLogs('append', options.cmd, `Process exited with status ${output.exitCode} (${output.took}ms)`);
          });
          this._handleLogs('close', options.cmd);
          return { commands: cachedOutputs, overall: Date.now() - now, fromCache: true, remoteCache: cache instanceof RemoteCache };
        } else {
          this._logger?.info('Cache outdated', { cmd: options.cmd, target: this.name });
        }
      }
      this._logger?.info('Running command');
      return this._runCommandsAndCache(cache, artifacts, options.cmd, options.args, options.env, options.stdio);
    } catch (e) {
      this._logger?.warn('Error reading cache', { cmd: options.cmd, target: this.name });
      // Error reading from cache
      return this._runCommandsAndCache(cache, artifacts, options.cmd, options.args, options.env, options.stdio);
    }
  }

  run(options: RunOptions): Observable<IProcessResult> {
    this._logger?.info('Preparing command', { cmd: options.cmd, workspace: this.name });
    return new Observable<IProcessResult>((obs) => {
      if (isUsingRemoteCache(options) && options.remoteCache) {
        checkWorkingDirectoryClean(this.project?.root);
      }
      this._logger?.info('Running cmd', { cmd: options.cmd, target: this.name });
      this._logger?.debug('Running cmd', options.cmd)
      this._run(options)
        .then((result) => {
          this._logger?.info('Success', { cmd: options.cmd, target: this.name }, result);
          obs.next(result)
        })
        .catch((error) => {
          this._logger?.warn('Errored', { cmd: options.cmd, target: this.name }, error);
          obs.error(error);
        }).finally(() => {
          this._logger?.debug('Completed', { cmd: options.cmd, target: this.name });
          obs.complete();
      });
    });
  }

  async invalidateLocalCache(
    cmd: string,
  ): Promise<void> {
    const cache = new LocalCache(this, cmd);
    await cache.invalidate();
  }

  async bumpVersions(bump: semver.ReleaseType, identifier?: string): Promise<PublishActions> {
    if (!this.project) {
      throw new MilaError(MilaErrorCode.PROJECT_NOT_RESOLVED, 'Cannot publish outside a project');
    }
    this._publish = new Publish(this.project);
    return this._publish.determineActions(this, bump, identifier);
  }

  publish(options = { access: 'public', dry: false }): Observable<PublishEvent> {
    if (!this._publish) {
      throw new MilaError(MilaErrorCode.PUBLISHED_WORKSPACE_WITHOUT_BUMP, 'You must bump versions before publishing');
    }
    return this._publish.release(options);
  }

  async getNpmInfos(): Promise<INpmInfos> {
    if (!this._npmInfos) {
      try {
        const result = await command(`yarn npm info ${this.name} --json`);
        const parsedInfos = JSON.parse(result.stdout) as INpmInfos;
        this._npmInfos = parsedInfos;
        return parsedInfos;
      } catch (e) {
        try {
          if (JSON.parse((e as ExecaError).stdout).name === 1) { // Not found
            this._npmInfos = { name: this.name, versions: []};
            return { name: this.name, versions: []};
          }
          throw e;
        } catch (_e) {
          throw e;
        }
      }
    }
    return this._npmInfos;
  }

  async isPublished(version: string): Promise<boolean> {
    const infos = await this.getNpmInfos();
    return infos.versions.includes(version);
  }

  async listGreaterVersionsInRegistry(version: string): Promise<Array<string>> {
    const infos = await this.getNpmInfos();
    return infos.versions.filter((v) => semver.gt(v, version));
  }

  async setVersion(version: string): Promise<void> {
    const manifest = await Workspace.loadPackage(this.root);
    manifest.version = version;
    await fs.writeFile(join(this.root, 'package.json'), JSON.stringify(manifest, null, 2));
  }

  async getLastReleaseOnRegistry(): Promise<string> {
    const infos = await this.getNpmInfos();
    return infos.versions.reduce((acc, val) => semver.gt(acc, val) ? acc : val, '0.0.0');
  }

  async getLastReleaseTag(): Promise<string> {
    const tags = await git.tags();
    return tags.all.filter((t) => t.startsWith(this.name)).reduce((acc, val) => semver.gt(acc, val.substring(this.name.length + 1)) ? acc : val.substring(this.name.length + 1), '0.0.0');
  }
}
