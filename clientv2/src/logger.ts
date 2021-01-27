export const logger = {
  scope: (scope: string) => ({
    debug: (...args: any[]) => console.debug(scope, ...args),
    info: (...args: any[]) => console.info(scope, ...args),
    warn: (...args: any[]) => console.warn(scope, ...args),
    error: (...args: any[]) => console.error(scope, ...args),
  })
}
