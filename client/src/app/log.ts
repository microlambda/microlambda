// FIXME: Proper type definition
// @ts-ignore
import * as Convert from 'ansi-to-html';
const convert = new Convert();

export type LogLevel = 'silly' | 'debug' | 'info' | 'warn' | 'error';

export interface IEventLog {
  level: LogLevel;
  date: string;
  scope: string;
  args: string[];
}

export class Log {

  _level: LogLevel;
  _date: string;
  _scope: string;
  _args: string[];

  constructor(log: IEventLog) {
    this._level = log.level;
    this._date = log.date;
    this._scope = log.scope;
    this._args = log.args;
  }

  get level(): LogLevel { return this._level }
  get date(): string { return this._date }
  get scope(): string { return this._scope }
  get args(): string { return this._args.map(arg => convert.toHtml(arg)).join(' ') }

  get class(): string {
    switch (this._level) {
      case 'debug':
        return 'blue';
      case 'error':
        return 'red';
      case 'info':
        return 'green';
      case 'silly':
        return 'cyan';
      case 'warn':
        return 'orange';
    }
  }
}
