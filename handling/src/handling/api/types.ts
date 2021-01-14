import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { OutgoingHttpHeaders } from 'http';

export class Response {
  statusCode?: number = undefined;
  headers: OutgoingHttpHeaders = {};
}

export interface IMultiValueHeaders {
  [header: string]: Array<boolean | number | string>;
}

export interface ISingleValueHeaders {
  [header: string]: boolean | number | string | undefined;
}

export type ApiHandlerEvent<TRequest = any> = Omit<APIGatewayProxyEvent, 'body'> & { body: TRequest };

export type ApiHandleContext = Context;

export type ApiHandler<TRequest = any, TResponse = any> = (
  event: ApiHandlerEvent<TRequest>,
  response: Response,
  context: ApiHandleContext,
) => Promise<TResponse>;

export type ApiBeforeMiddleware<TRequest = any> = (
  event: ApiHandlerEvent<TRequest>,
  context: ApiHandleContext,
) => Promise<void>;

export type ApiAfterMiddleware<TRequest = any> = (
  event: ApiHandlerEvent<TRequest>,
  result: APIGatewayProxyResult,
) => Promise<void>;

export type ApiErrorHandler<TRequest = any> = (
  event: ApiHandlerEvent<TRequest>,
  err: Error,
  result: APIGatewayProxyResult,
) => Promise<void>;
