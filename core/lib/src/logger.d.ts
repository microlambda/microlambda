declare type LoggerFunction = (...args: any[]) => void;
export interface ILogger {
    silly: LoggerFunction;
    debug: LoggerFunction;
    info: LoggerFunction;
    warn: LoggerFunction;
    error: LoggerFunction;
}
export declare const prefix: {
    info: string;
    error: string;
};
declare type LogLevel = 'silly' | 'debug' | 'info' | 'warn' | 'error';
export interface IEventLog {
    level: LogLevel;
    date: string;
    scope: string;
    args: string[];
}
export declare class Logger {
    private _logs;
    private _logs$;
    logs$: import("rxjs").Observable<IEventLog>;
    get logs(): IEventLog[];
    log(scope?: string): ILogger;
}
export {};
