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
  [header: string]: boolean | number | string;
}

export type ApiHandlerEvent<TRequest = unknown> = APIGatewayProxyEvent & { body: TRequest };

export type ApiHandleContext = Context;

export type ApiHandler<TRequest = unknown, TResponse = unknown> = (
  event: ApiHandlerEvent<TRequest>,
  response: Response,
  context: ApiHandleContext,
) => Promise<TResponse>;

export type ApiBeforeMiddleware<TRequest = unknown> = (
  event: ApiHandlerEvent<TRequest>,
  context: ApiHandleContext,
) => Promise<void>;

export type ApiAfterMiddleware<TRequest = unknown> = (
  event: ApiHandlerEvent<TRequest>,
  result: APIGatewayProxyResult,
) => Promise<void>;

export type ApiErrorHandler<TRequest = unknown> = (
  event: ApiHandlerEvent<TRequest>,
  err: Error,
  result: APIGatewayProxyResult,
) => Promise<void>;
