export class Debouncer<A extends unknown[], R> {
  private _throttled: NodeJS.Timeout | null;
  private readonly _action: (...args: A) => R;
  private readonly _ms: number;
  constructor(action: (...args: A) => R, ms: number) {
    this._action = action;
    this._ms = ms;
    this._throttled = null;
  }
  perform(...args: A): void {
    if (this._throttled) {
      clearTimeout(this._throttled);
    }
    this._throttled = setTimeout(() => {
      this._action(...args);
    }, this._ms);
  }
}
