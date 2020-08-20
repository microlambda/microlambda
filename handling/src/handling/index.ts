import { APIGatewayProxyHandler, Callback, Context, Handler, APIGatewayEvent } from 'aws-lambda';

import { runInitializers } from '../init';
import { apiHandler, ApiHandler } from './api';
import { log } from '../debug';

let initPromise: Promise<unknown>;
let callInit = true;

const isApi = (event: unknown): false | ((next: ApiHandler) => APIGatewayProxyHandler) => {
  return (event as APIGatewayEvent).pathParameters !== undefined ? apiHandler : false;
};

export type DefaultHandler = (event: unknown, context: unknown) => Promise<unknown>;

const throwUnhandledEvent = (): void => {
  const error = new Error('Unhandled event');
  error.name = 'UnhandledEvent';
  throw error;
};

export const handle = (next: ApiHandler | DefaultHandler, shouldThrowOnUnhandled = true): Handler => {
  log.debug('[HANDLE] Handling event with function', next.name);
  if (callInit) {
    log.debug('[HANDLE] Calling initializers');
    callInit = false;
    initPromise = runInitializers();
  }

  return async (event: unknown, context: Context, callback: Callback): Promise<unknown> => {
    await initPromise;
    log.debug('[HANDLE] Initializers ran successfully');
    log.debug('[HANDLE] Is API Gateway handler', isApi(event));
    for (const check of [isApi]) {
      const result = check(event);
      if (result) {
        return result(next)(event as APIGatewayEvent, context, callback);
      }
    }
    if (shouldThrowOnUnhandled) {
      log.debug('[HANDLE] Unhandled event !');
      throwUnhandledEvent();
    }
    log.debug('[HANDLE] Using default handler');
    return (next as DefaultHandler)(event, context);
  };
};
