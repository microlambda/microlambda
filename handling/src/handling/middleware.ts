import { ApiAfterMiddleware, ApiBeforeMiddleware, ApiErrorHandler } from './api';
import { log } from '../debug';
import { Context } from 'aws-lambda';

export type DefaultBeforeMiddleware = (event: any, context: Context) => Promise<void>;
export type BeforeMiddleware = ApiBeforeMiddleware | DefaultAfterMiddleware;

export type DefaultAfterMiddleware = (event: any, result: any) => Promise<void>;
export type AfterMiddleware = ApiAfterMiddleware | DefaultAfterMiddleware;

export type DefaultErrorHandler = (event: any, error: any, result: any) => Promise<void>;
export type ErrorHandler = ApiErrorHandler | DefaultErrorHandler;

export type HandlingType = 'ApiGateway';

export type MiddlewareListItem<Before, After, ErrHandler> = { before: Before[]; after: After[]; errors: ErrHandler[] };
export type MiddlewareList = {
  __ALWAYS__: MiddlewareListItem<DefaultBeforeMiddleware, DefaultAfterMiddleware, DefaultErrorHandler>;
  ApiGateway: MiddlewareListItem<ApiBeforeMiddleware, ApiAfterMiddleware, ApiErrorHandler>;
};

const middlewareList: MiddlewareList = {
  __ALWAYS__: { before: [], after: [], errors: [] },
  ApiGateway: { before: [], after: [], errors: [] },
};

const isSendingType = (
  typeOrMiddleware: HandlingType | BeforeMiddleware[] | AfterMiddleware[] | ErrorHandler[],
): typeOrMiddleware is HandlingType => typeof typeOrMiddleware === 'string';

export const callBeforeMiddleware = async <T extends (event: any, context: Context) => any>(
  type: HandlingType,
  args: Parameters<T>,
): Promise<void> => {
  log.debug(
    '[MIDDLEWARE][BEFORE] Running generic middleware',
    middlewareList.__ALWAYS__.before.map((f) => f.name),
  );
  for (const middleware of middlewareList.__ALWAYS__.before) {
    await middleware.apply({}, args);
  }
  log.debug(
    '[MIDDLEWARE][BEFORE] Running API gateway middleware',
    middlewareList.ApiGateway.before.map((f) => f.name),
  );
  for (const middleware of middlewareList.ApiGateway.before) {
    await middleware.apply({}, args);
  }
};

export const callAfterMiddleware = async <T extends (event: any, result: any) => any>(
  type: HandlingType,
  args: Parameters<T>,
): Promise<void> => {
  log.debug(
    '[MIDDLEWARE][AFTER] Running generic middleware',
    middlewareList.__ALWAYS__.after.map((f) => f.name),
  );
  for (const middleware of middlewareList.ApiGateway.after) {
    await middleware.apply({}, args);
  }
  log.debug(
    '[MIDDLEWARE][AFTER] Running API gateway middleware',
    middlewareList.ApiGateway.after.map((f) => f.name),
  );
  for (const middleware of middlewareList.__ALWAYS__.after) {
    await middleware.apply({}, args);
  }
};

export const callErrorHandlers = async <T extends (event: any, error: any, result: any) => any>(
  type: HandlingType,
  args: Parameters<T>,
): Promise<void> => {
  log.debug(
    '[MIDDLEWARE][ERROR] Running generic middleware',
    middlewareList.__ALWAYS__.errors.map((f) => f.name),
  );
  for (const middleware of middlewareList.ApiGateway.errors) {
    await middleware.apply({}, args);
  }
  log.debug(
    '[MIDDLEWARE][ERROR] Running API gateway middleware',
    middlewareList.ApiGateway.errors.map((f) => f.name),
  );
  for (const middleware of middlewareList.__ALWAYS__.errors) {
    await middleware.apply({}, args);
  }
};

export function before(type: 'ApiGateway', middleware: ApiBeforeMiddleware[]): void;
export function before(middleware: DefaultBeforeMiddleware[]): void;
export function before(typeOrMiddleware: HandlingType | BeforeMiddleware[], middleware: BeforeMiddleware[] = []): void {
  log.debug('[MIDDLEWARE][BEFORE] Registering middleware', {
    type: Array.isArray(typeOrMiddleware) ? '__ALWAYS__' : typeOrMiddleware,
    middleware: Array.isArray(typeOrMiddleware) ? typeOrMiddleware.map((f) => f.name) : middleware.map((f) => f.name),
  });
  if (!isSendingType(typeOrMiddleware)) {
    middlewareList['__ALWAYS__'].before = typeOrMiddleware;
  } else {
    middlewareList[typeOrMiddleware].before = middleware;
  }
}

export function after(type: 'ApiGateway', middleware: ApiAfterMiddleware[]): void;
export function after(middleware: DefaultAfterMiddleware[]): void;
export function after(typeOrMiddleware: HandlingType | AfterMiddleware[], middleware: AfterMiddleware[] = []): void {
  log.debug('[MIDDLEWARE][AFTER] Registering middleware', {
    type: Array.isArray(typeOrMiddleware) ? '__ALWAYS__' : typeOrMiddleware,
    middleware: Array.isArray(typeOrMiddleware) ? typeOrMiddleware.map((f) => f.name) : middleware.map((f) => f.name),
  });
  if (!isSendingType(typeOrMiddleware)) {
    middlewareList['__ALWAYS__'].after = typeOrMiddleware;
  } else {
    middlewareList[typeOrMiddleware].after = middleware;
  }
}

export function handleError(type: 'ApiGateway', middleware: ApiErrorHandler[]): void;
export function handleError(middleware: DefaultErrorHandler[]): void;
export function handleError(typeOrMiddleware: HandlingType | ErrorHandler[], middleware: ErrorHandler[] = []): void {
  log.debug('[MIDDLEWARE][ERROR] Registering middleware', {
    type: Array.isArray(typeOrMiddleware) ? '__ALWAYS__' : typeOrMiddleware,
    middleware: Array.isArray(typeOrMiddleware) ? typeOrMiddleware.map((f) => f.name) : middleware.map((f) => f.name),
  });
  if (!isSendingType(typeOrMiddleware)) {
    middlewareList['__ALWAYS__'].errors = typeOrMiddleware;
  } else {
    middlewareList[typeOrMiddleware].errors = middleware;
  }
}
