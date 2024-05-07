export interface IBaseLogger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

export interface IExtendedLogger extends IBaseLogger {
  lf: () => void;
  separator: () => void;
}
