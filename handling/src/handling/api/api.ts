import {
  APIGatewayEvent,
  APIGatewayProxyEvent,
  APIGatewayProxyHandler,
  APIGatewayProxyResult,
  Context,
} from 'aws-lambda';
import { OutgoingHttpHeaders } from 'http';

import { IApiConfigCorsOptions, getConfig } from '../../config';
import { callAfterMiddleware, callBeforeMiddleware, callErrorHandlers } from '../middleware';
import {
  ApiAfterMiddleware,
  ApiBeforeMiddleware,
  ApiErrorHandler,
  ApiHandler,
  ApiHandlerEvent,
  IMultiValueHeaders,
  Response,
  ISingleValueHeaders,
} from './types';
import { log } from '../../debug';

const normalize = (event: APIGatewayProxyEvent): ApiHandlerEvent => {
  log.debug('[API] Normalizing event');
  const clonedEvent = Object.assign(event);
  if (event.body) {
    try {
      log.debug('[API] Parsing request body from JSON');
      clonedEvent.body = JSON.parse(clonedEvent.body);
    } catch (e) {
      log.debug('[API] ERROR: Only JSON Accepted');
      const error = new Error('Only JSON payloads are accepted');
      error.name = 'BadRequestError';
      throw error;
    }
  }

  return clonedEvent;
};

const httpMethodToStatus = (method: string, statusCode?: number): number => {
  log.debug('[API] Setting status code for method', method, statusCode || (method === 'POST' ? 201 : 200));
  return statusCode || (method === 'POST' ? 201 : 200);
};

const getHeader = (event: ApiHandlerEvent, headerName: string): string | undefined => {
  for (const header of Object.keys(event.headers)) {
    if (header.toLowerCase() === headerName.toLowerCase()) {
      return event.headers[header];
    }
  }
  return undefined;
};

const singleHeaders = (event: ApiHandlerEvent, headers: OutgoingHttpHeaders): ISingleValueHeaders => {
  const finalHeaders = Object.keys(headers)
    .filter((k: string) => ['boolean', 'string', 'number'].indexOf(typeof headers[k]) > -1)
    .reduce((p: ISingleValueHeaders, k: string) => Object.assign(p, { [k]: headers[k] }), {});
  const cors = getConfig().api.cors as IApiConfigCorsOptions;
  log.debug('[API] Reading CORS config', cors);
  if (cors) {
    finalHeaders['Access-Control-Allow-Origin'] = cors.origin ?? getHeader(event, 'Origin');
  }
  return finalHeaders;
};

const multipleHeaders = (event: ApiHandlerEvent, headers: OutgoingHttpHeaders): IMultiValueHeaders => {
  const finalHeaders = Object.keys(headers)
    .filter((k: string) => ['boolean', 'string', 'number'].indexOf(typeof headers[k]) === -1)
    .reduce((p: IMultiValueHeaders, k: string) => Object.assign(p, { [k]: headers[k] }), {});

  const cors = getConfig().api.cors as IApiConfigCorsOptions;
  if (cors) {
    const allowedMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];
    const exposedHeaders = Object.keys(headers).filter((v, i, a) => a.indexOf(v) === i);
    finalHeaders['Access-Control-Allow-Methods'] = cors.methods || allowedMethods;
    finalHeaders['Access-Control-Expose-Headers'] = cors.exposeHeaders || exposedHeaders;
    finalHeaders['Access-Control-Allow-Headers'] = cors.allowHeaders || Object.keys(event.headers);
  }
  return finalHeaders;
};

const format = (event: ApiHandlerEvent, response: Response, content: any): APIGatewayProxyResult => {
  log.debug('[API] Formatting response');
  log.debug('[API] Setting headers');
  const headers = singleHeaders(event, response.headers);
  const multiValueHeaders = multipleHeaders(event, response.headers);
  // undefined headers are no more supported in AWS lambda type definitions
  const apiGatewayHeaders: { [key: string]: string | number | boolean } = {};
  Object.keys(headers).forEach((key) => {
    const value = headers[key];
    if (value) {
      apiGatewayHeaders[key] = value;
    }
  });
  if (content === null || content === undefined || content === '') {
    log.debug('[API] No content returning 204');
    return {
      headers: apiGatewayHeaders,
      multiValueHeaders,
      statusCode: event.httpMethod === 'POST' ? 201 : 204,
      body: '',
    };
  }
  return {
    headers: apiGatewayHeaders,
    multiValueHeaders,
    statusCode: httpMethodToStatus(event.httpMethod, response.statusCode),
    body: JSON.stringify(content, (key, value) => {
      return getConfig().api.blacklist.indexOf(key) > -1 ? undefined : value;
    }),
  };
};

const formatError = (
  event: APIGatewayProxyEvent,
  response: Response,
  err: { name: string; details?: any; statusCode?: number; body?: any },
): APIGatewayProxyResult => {
  log.debug('[API] Error name', err.name);
  switch (err.name) {
    case 'ValidationError':
      log.debug('[API] 422 - Validation error');
      response.statusCode = 422;
      return format(event, response, { data: err.details });
    case 'BadRequestError':
      log.debug('[API] 400 - Bad request');
      response.statusCode = 400;
      return format(event, response, err.details ? { data: err.details } : 'Bad Request');
    case 'ForbiddenError':
      response.statusCode = 403;
      return format(event, response, err.details ? { data: err.details } : 'Forbidden');
    default:
      log.debug('[API] 500 - Generic error');
      response.statusCode = err.statusCode || 500;
      return format(event, response, err.body || 'Internal Server Error');
  }
};

export class HandlingError extends Error {
  statusCode?: number;
  body?: any;
  details?: any;
}

export const apiHandler = (next: ApiHandler): APIGatewayProxyHandler => {
  return async (event: APIGatewayEvent, context: Context): Promise<APIGatewayProxyResult> => {
    log.debug('[API] Initializing response');
    const response = new Response();
    try {
      log.debug('[API] Normalizing event', event);
      const normalizedEvent = await normalize(event);
      log.debug('[API] Normalized event', normalizedEvent);
      log.debug('[API] Calling before middleware');
      await callBeforeMiddleware<ApiBeforeMiddleware>('ApiGateway', [normalizedEvent, context]);
      log.debug('[API] Run business logic code');
      const result = format(normalizedEvent, response, await next(normalizedEvent, response, context));
      log.debug('[API] Formatted result', result);
      log.debug('[API] Calling after middleware');
      await callAfterMiddleware<ApiAfterMiddleware>('ApiGateway', [normalizedEvent, result]);
      return result;
    } catch (e) {
      const err = e as HandlingError;
      log.debug('[API] Error happened !', err);
      const result = formatError(event, response, err);
      log.debug('[API] Formatted', result);
      log.debug('[API] Calling error middleware');
      await callErrorHandlers<ApiErrorHandler>('ApiGateway', [event, err, result]);
      return result;
    }
  };
};
