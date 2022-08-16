import { Subject, Observable } from "rxjs";
import { OrderedTargets } from "./targets";
import { IResolvedTarget } from "./process";
import { watch, FSWatcher } from "chokidar";
import { IAbstractLogger, IAbstractLoggerFunctions } from "./logger";
import { join } from 'path';

export interface IChangeEvent {
  event: "add" | "addDir" | "change" | "unlink" | "unlinkDir";
  path: string;
}

export interface WatchEvent {
  target: IResolvedTarget;
  events: Array<IChangeEvent>;
}

export class Watcher {

  public readonly targets: IResolvedTarget[];
  private _watcher: FSWatcher | undefined;

  constructor(
    steps: OrderedTargets,
    public readonly cmd: string,
    public readonly debounce = 0,
    logger?: IAbstractLogger,
  ) {
    this.targets = steps.flat();
    this._logger = logger?.log('@centipod/core/watcher');
  }

  private _logger: IAbstractLoggerFunctions | undefined;
  private _events$ = new Subject<Array<WatchEvent>>();

  watch(): Observable<Array<WatchEvent>> {
    this.unwatch();
    const filesChanges = new Map<IResolvedTarget, Array<IChangeEvent>>();
    this.targets.forEach((target) => {
      const patterns = target.workspace.config[this.cmd]?.src;
      patterns?.forEach((glob) => {
        this._logger?.info('Watching', join(target.workspace.root, glob));
        this._watcher = watch(join(target.workspace.root, glob)).on('all', (event, path) => {
          if (event === 'change') {
            if (filesChanges.has(target)) {
              filesChanges.get(target)?.push({ event, path });
            } else {
              filesChanges.set(target, [{ event, path }]);
            }
          }
        });
      });
    });
    setInterval(() => {
      if (filesChanges.size) {
        this._logger?.debug('Sources changed', filesChanges);
        this._events$.next(Array.from(filesChanges.entries()).map(([target, events]) => ({
          target,
          events,
        })));
      }
      filesChanges.clear();
    }, this.debounce);
    return this._events$.asObservable();
  }

  unwatch(): void {
    this._watcher?.close();
    this._events$ = new Subject<Array<WatchEvent>>();
  }
}
