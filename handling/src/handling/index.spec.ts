import { runInitializers } from '../init';
import {apiHandler, HandlingError} from './api';
import { handle } from './index';
import Mock = jest.Mock;

export type TestingHandler = (event?: unknown, context?: unknown, callback?: unknown) => unknown;

jest.mock('../init');
jest.mock('./api');

describe('handling', () => {
  describe('handle', () => {
    it('calls runInitializers function once', async () => {
      handle(async (): Promise<null> => null);
      handle(async (): Promise<null> => null);
      expect((runInitializers as Mock).mock.calls.length).toBe(1);
    });

    it('redirects to the api gateway handler correctly', async () => {
      const expected = {};

      (apiHandler as Mock).mockReturnValue(() => expected);

      const handler = handle(async (): Promise<null> => null) as TestingHandler;

      const result = await handler({ pathParameters: null });

      expect(result).toBe(expected);
    });

    it('throws on unhandled events', async () => {
      let called = false;
      const handler = handle(async () => (called = true)) as TestingHandler;
      try {
        await handler({});
        fail();
      } catch (err) {
        const e = err as HandlingError;
        expect(e.name).toBe('UnhandledEvent');
        expect(called).toBe(false);
      }
    });

    it('does not throw on unhandled events when shouldThrowOnUnhandled = false', async () => {
      const expected = {};
      const handler = handle(async () => expected, false) as TestingHandler;

      const result = await handler({});

      expect(result).toBe(expected);
    });
  });
});
