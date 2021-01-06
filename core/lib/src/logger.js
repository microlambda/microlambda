"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = exports.prefix = void 0;
const chalk_1 = require("chalk");
const util_1 = require("util");
const rxjs_1 = require("rxjs");
exports.prefix = {
    info: chalk_1.green('[INFO]'),
    error: chalk_1.red('[ERROR]'),
};
class Logger {
    constructor() {
        this._logs = [];
        this._logs$ = new rxjs_1.Subject();
        this.logs$ = this._logs$.asObservable();
    }
    get logs() {
        return this._logs;
    }
    log(scope) {
        const logLevel = ['silent', 'silly', 'debug', 'info', 'warn', 'error'].includes(process.env.MILA_LOG_LEVEL)
            ? process.env.MILA_LOG_LEVEL
            : 'silent';
        const inScope = process.env.MILA_DEBUG === '*' || (process.env.MILA_DEBUG && process.env.MILA_DEBUG.split(',').includes(scope));
        const isPrimitive = (arg) => typeof arg === 'string' || typeof arg === 'number' || typeof arg === 'boolean';
        const toEvent = (level, args) => ({
            level,
            date: new Date().toISOString(),
            scope,
            args: args.map((arg) => (isPrimitive(arg) ? arg : util_1.inspect(arg, null, 2, false))),
        });
        return {
            silly: (...args) => {
                const event = toEvent('silly', args);
                if (['silly'].includes(logLevel) && inScope) {
                    console.debug(chalk_1.cyan('[SILLY]'), chalk_1.bold(scope), ...args);
                }
                this._logs.push(event);
                this._logs$.next(event);
            },
            debug: (...args) => {
                const event = toEvent('debug', args);
                if (['silly', 'debug'].includes(logLevel) && inScope) {
                    console.debug(chalk_1.blue('[DEBUG]'), chalk_1.bold(scope), ...args);
                }
                this._logs.push(event);
                this._logs$.next(event);
            },
            info: (...args) => {
                const event = toEvent('info', args);
                if (['silly', 'debug', 'info'].includes(logLevel)) {
                    console.info(exports.prefix.info, ...args);
                }
                this._logs.push(event);
                this._logs$.next(event);
            },
            warn: (...args) => {
                const event = toEvent('warn', args);
                if (['silly', 'debug', 'info', 'warn'].includes(logLevel)) {
                    console.info(chalk_1.yellow('[WARNING]', ...args));
                }
                this._logs.push(event);
                this._logs$.next(event);
            },
            error: (...args) => {
                const event = toEvent('error', args);
                if (['silly', 'debug', 'info', 'warn', 'error'].includes(logLevel)) {
                    console.info(exports.prefix.error, ...args);
                }
                this._logs.push(event);
                this._logs$.next(event);
            },
        };
    }
}
exports.Logger = Logger;
//# sourceMappingURL=logger.js.map