import { Subject, Observable } from "rxjs";
import { OrderedTargets } from "./targets";
import { IResolvedTarget } from "./process";
import { watch, FSWatcher } from "chokidar";
import { join } from 'path';
import { EventsLog, EventsLogger } from '@microlambda/logger';

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
  private readonly _logger: EventsLogger | undefined;
  static readonly scope = 'runner-core/watcher';

  constructor(
    steps: OrderedTargets,
    public readonly cmd: string,
    public readonly debounce = 0,
    eventsLog?: EventsLog,
  ) {
    this.targets = steps.flat();
    this._logger = eventsLog?.scope(Watcher.scope);
  }

  private _events$ = new Subject<Array<WatchEvent>>();

  watch(): Observable<Array<WatchEvent>> {
    this.unwatch();
    const filesChanges = new Map<IResolvedTarget, Array<IChangeEvent>>();
    this.targets.forEach((target) => {
      const patterns = target.workspace.config[this.cmd]?.src?.internals;
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
