import { runInitializers } from '../init';
import { apiHandler } from './api';
import { handle } from './index';
import Mock = jest.Mock;

export type TestingHandler = (event?: unknown, context?: unknown, callback?: unknown) => unknown;

jest.mock('../init');
jest.mock('./api');

describe('handling', () => {
  describe('handle', () => {
    it('calls runInitializers function once', async () => {
      handle(async () => null);
      handle(async () => null);
      expect((runInitializers as Mock).mock.calls.length).toBe(1);
    });

    it('redirects to the api gateway handler correctly', async () => {
      const expected = {};

      (apiHandler as Mock).mockReturnValue(() => expected);

      const handler = handle(async () => null) as TestingHandler;

      const result = await handler({ pathParameters: null });

      expect(result).toBe(expected);
    });

    it('throws on unhandled events', async () => {
      expect.assertions(2);
      let called = false;
      const handler = handle(async () => (called = true)) as TestingHandler;

      try {
        await handler({});
      } catch (e) {
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
