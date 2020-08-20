import { APIGatewayProxyEvent } from 'aws-lambda';

import 'jest-extended';

import { getConfig } from '../../config';
import { TestingHandler } from '../index.spec';
import { callAfterMiddleware, callBeforeMiddleware, callErrorHandlers } from '../middleware';
import { apiHandler } from './api';

jest.mock('../../config');
jest.mock('../middleware');
const mock = getConfig as jest.Mock;

describe('handling', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mock.mockReturnValue({ api: { cors: false, blacklist: [] } });
  });

  describe('api', () => {
    it('runs middlewares before and after the handler', async () => {
      const handler = jest.fn();

      await (apiHandler(handler) as TestingHandler)({});

      expect(handler).toHaveBeenCalledAfter(callBeforeMiddleware as jest.Mock);
      expect(handler).toHaveBeenCalledBefore(callAfterMiddleware as jest.Mock);
    });

    it('parses request body correctly', async () => {
      expect.assertions(1);
      const body = { email: 'foo@example.com' };
      (apiHandler(async (event: APIGatewayProxyEvent) => {
        expect(event.body).toStrictEqual(body);
      }) as TestingHandler)({ body: JSON.stringify(body) });
    });

    it('throws a 400 Bad Request when request body is incorrect', async () => {
      const response = await (apiHandler(async (): Promise<null> => null) as TestingHandler)({ body: 'not json' });

      expect(response).toStrictEqual({
        statusCode: 400,
        headers: {},
        multiValueHeaders: {},
        body: JSON.stringify('Bad Request'),
      });
    });

    it('returns a correct ApiGatewayProxyResponse', async () => {
      const body = { email: 'foo@example.com' };

      const response = await (apiHandler(
        async (): Promise<{ email: string }> => {
          return body;
        },
      ) as TestingHandler)({});

      expect(response).toStrictEqual({
        statusCode: 200,
        headers: {},
        multiValueHeaders: {},
        body: JSON.stringify(body),
      });
    });

    it('returns a 201 when POST succeeds', async () => {
      const response = await (apiHandler(async (): Promise<{}> => ({})) as TestingHandler)({ httpMethod: 'POST' });

      expect(response).toStrictEqual({
        statusCode: 201,
        headers: {},
        multiValueHeaders: {},
        body: JSON.stringify({}),
      });
    });

    it('returns a 201 when response body is empty and request method is POST', async () => {
      const response = await (apiHandler(async (): Promise<null> => null) as TestingHandler)({ httpMethod: 'POST' });

      expect(response).toStrictEqual({
        statusCode: 201,
        headers: {},
        multiValueHeaders: {},
        body: '',
      });
    });

    it('returns a 204 when response body is empty', async () => {
      const response = await (apiHandler(
        async (): Promise<void> => {
          // empty
        },
      ) as TestingHandler)({});

      expect(response).toStrictEqual({
        statusCode: 204,
        headers: {},
        multiValueHeaders: {},
        body: '',
      });
    });

    it('returns a 204 when response body is null', async () => {
      const response = await (apiHandler(async (): Promise<null> => null) as TestingHandler)({});

      expect(response).toStrictEqual({
        statusCode: 204,
        headers: {},
        multiValueHeaders: {},
        body: '',
      });
    });

    it('returns a 204 when response body is undefined', async () => {
      const response = await (apiHandler(async (): Promise<void> => undefined) as TestingHandler)({});

      expect(response).toStrictEqual({
        statusCode: 204,
        headers: {},
        multiValueHeaders: {},
        body: '',
      });
    });

    it('returns a 204 when response body is an empty string', async () => {
      const response = await (apiHandler(async (): Promise<string> => '') as TestingHandler)({});

      expect(response).toStrictEqual({
        statusCode: 204,
        headers: {},
        multiValueHeaders: {},
        body: '',
      });
    });

    it('does NOT return 204 when response body is false', async () => {
      const response = await (apiHandler(async (): Promise<boolean> => false) as TestingHandler)({});

      expect(response).toStrictEqual({
        statusCode: 200,
        headers: {},
        multiValueHeaders: {},
        body: 'false',
      });
    });

    it('strips response body of configured blacklist', async () => {
      mock.mockReturnValue({ api: { blacklist: ['password'] } });

      const response = await (apiHandler(
        async (): Promise<{ password: string }> => ({ password: 'password' }),
      ) as TestingHandler)({});

      expect(response).toStrictEqual({
        statusCode: 200,
        headers: {},
        multiValueHeaders: {},
        body: JSON.stringify({}),
      });
    });

    it('adds cors headers with correct configuration', async () => {
      mock.mockReturnValue({ api: { cors: true } });

      const headers = { 'origin': 'localhost', 'x-foo': 'foo', 'x-bar': 'bar' };
      const response = await (apiHandler(
        async (_, response): Promise<null> => {
          response.headers['x-baz'] = 'baz';
          return null;
        },
      ) as TestingHandler)({ headers });

      expect(response).toStrictEqual({
        statusCode: 204,
        headers: {
          'Access-Control-Allow-Origin': 'localhost',
          'x-baz': 'baz',
        },
        multiValueHeaders: {
          'Access-Control-Allow-Headers': ['origin', 'x-foo', 'x-bar'],
          'Access-Control-Allow-Methods': ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
          'Access-Control-Expose-Headers': ['x-baz'],
        },
        body: '',
      });
    });

    it('formats validation errors', async () => {
      const errorDetails = [{}];

      const response = await (apiHandler(
        async (): Promise<void> => {
          throw {
            name: 'ValidationError',
            details: errorDetails,
          };
        },
      ) as TestingHandler)({});

      expect(response).toStrictEqual({
        statusCode: 422,
        headers: {},
        multiValueHeaders: {},
        body: JSON.stringify({ data: errorDetails }),
      });
    });

    it('formats forbidden errors', async () => {
      const response = await (apiHandler(
        async (): Promise<void> => {
          throw {
            name: 'ForbiddenError',
          };
        },
      ) as TestingHandler)({});

      expect(response).toStrictEqual({
        statusCode: 403,
        headers: {},
        multiValueHeaders: {},
        body: JSON.stringify('Forbidden'),
      });
    });

    it('formats forbidden errors with additional details if provided', async () => {
      const errorDetails = { reason: 'You are not allowed to do this. Only Chuck Norris can.' };
      const response = await (apiHandler(
        async (): Promise<void> => {
          throw {
            name: 'ForbiddenError',
            details: errorDetails,
          };
        },
      ) as TestingHandler)({});

      expect(response).toStrictEqual({
        statusCode: 403,
        headers: {},
        multiValueHeaders: {},
        body: JSON.stringify({ data: errorDetails }),
      });
    });

    it('formats bad request errors', async () => {
      const response = await (apiHandler(
        async (): Promise<void> => {
          throw {
            name: 'BadRequestError',
          };
        },
      ) as TestingHandler)({});

      expect(response).toStrictEqual({
        statusCode: 400,
        headers: {},
        multiValueHeaders: {},
        body: JSON.stringify('Bad Request'),
      });
    });

    it('formats bad request errors with additional details if provided', async () => {
      const errorDetails = "You can't turn a Smurf red. Smurf are BLUE.";
      const response = await (apiHandler(
        async (): Promise<void> => {
          throw {
            name: 'BadRequestError',
            details: errorDetails,
          };
        },
      ) as TestingHandler)({});

      expect(response).toStrictEqual({
        statusCode: 400,
        headers: {},
        multiValueHeaders: {},
        body: JSON.stringify({ data: errorDetails }),
      });
    });

    it('throws a 500 when an error happens', async () => {
      const response = await (apiHandler(
        async (): Promise<void> => {
          throw 'error';
        },
      ) as TestingHandler)({});

      expect(response).toStrictEqual({
        statusCode: 500,
        headers: {},
        multiValueHeaders: {},
        body: JSON.stringify('Internal Server Error'),
      });
    });

    it('returns the correct status code for an error', async () => {
      const response = await (apiHandler(
        async (): Promise<void> => {
          throw { body: 'error', statusCode: 400 };
        },
      ) as TestingHandler)({});

      expect(response).toStrictEqual({
        statusCode: 400,
        headers: {},
        multiValueHeaders: {},
        body: JSON.stringify('error'),
      });
    });

    it('calls error handlers when an error happens', async () => {
      await (apiHandler(
        async (): Promise<void> => {
          throw 'error';
        },
      ) as TestingHandler)({});

      expect(callErrorHandlers).toHaveBeenCalledTimes(1);
    });

    it('does not return the content directly anymore, even with statusCode', async () => {
      const response = await (apiHandler(
        async (): Promise<{ statusCode: number; body: string }> => {
          return { statusCode: 200, body: JSON.stringify('foo') };
        },
      ) as TestingHandler)({});

      expect(response).toStrictEqual({
        statusCode: 200,
        headers: {},
        multiValueHeaders: {},
        body: JSON.stringify({
          statusCode: 200,
          body: '"foo"',
        }),
      });
    });
  });
});
