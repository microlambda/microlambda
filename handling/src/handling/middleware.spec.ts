import {
  after,
  before,
  callAfterMiddleware,
  callBeforeMiddleware,
  callErrorHandlers,
  handleError,
  HandlingType,
} from './middleware';
import { stub } from 'sinon';
import { Context } from 'aws-lambda';

describe('handling', () => {
  describe('middleware', () => {
    const fct = async (): Promise<void> => {
      return;
    };
    it(`allows registering for _ALWAYS_`, () => {
      expect(() => before([fct])).not.toThrow();
      expect(() => after([fct])).not.toThrow();
      expect(() => handleError([fct])).not.toThrow();
    });
    const testMiddlewareTypes: HandlingType[] = ['ApiGateway'];
    testMiddlewareTypes.forEach((key) => {
      it(`allows registering for ${key}`, () => {
        expect(() => before(key, [fct])).not.toThrow();
        expect(() => after(key, [fct])).not.toThrow();
        expect(() => handleError(key, [fct])).not.toThrow();
      });
    });

    it('registers a middleware without calling it', () => {
      const middleware = stub();
      before('ApiGateway', [middleware]);
      expect(middleware.callCount).toBe(0);

      after('ApiGateway', [middleware]);
      expect(middleware.callCount).toBe(0);
    });

    it('runs error handlers correctly', async () => {
      const apiErrorMiddleware = stub();
      const genericErrorMiddleware = stub();
      handleError('ApiGateway', [apiErrorMiddleware]);
      handleError([genericErrorMiddleware]);
      await callErrorHandlers('ApiGateway', [{}, {}, {}]);
      expect(genericErrorMiddleware.calledAfter(apiErrorMiddleware)).toBe(true);
      expect(apiErrorMiddleware.calledBefore(genericErrorMiddleware)).toBe(true);
    });

    it('runs middlewares in the correct order', async () => {
      const middlwares = [stub(), stub(), stub(), stub(), stub(), stub(), stub(), stub()];

      before([middlwares[0], middlwares[1]]);
      before('ApiGateway', [middlwares[2], middlwares[3]]);
      after('ApiGateway', [middlwares[4], middlwares[5]]);
      after([middlwares[6], middlwares[7]]);

      await callBeforeMiddleware('ApiGateway', [{}, {} as Context]);
      await callAfterMiddleware('ApiGateway', [{}, {}]);

      [1, 2, 3, 4, 5, 6, 7].forEach((i) => expect(middlwares[0].calledBefore(middlwares[i])).toBe(true));
      [2, 3, 4, 5, 6, 7].forEach((i) => expect(middlwares[1].calledBefore(middlwares[i])).toBe(true));
      [3, 4, 5, 6, 7].forEach((i) => expect(middlwares[2].calledBefore(middlwares[i])).toBe(true));
      [4, 5, 6, 7].forEach((i) => expect(middlwares[3].calledBefore(middlwares[i])).toBe(true));
      [5, 6, 7].forEach((i) => expect(middlwares[4].calledBefore(middlwares[i])).toBe(true));
      [6, 7].forEach((i) => expect(middlwares[5].calledBefore(middlwares[i])).toBe(true));
      [7].forEach((i) => expect(middlwares[6].calledBefore(middlwares[i])).toBe(true));

      [0, 1, 2, 3, 4, 5, 6].forEach((i) => expect(middlwares[7].calledAfter(middlwares[i])).toBe(true));
      [0, 1, 2, 3, 4, 5].forEach((i) => expect(middlwares[6].calledAfter(middlwares[i])).toBe(true));
      [0, 1, 2, 3, 4].forEach((i) => expect(middlwares[5].calledAfter(middlwares[i])).toBe(true));
      [0, 1, 2, 3].forEach((i) => expect(middlwares[4].calledAfter(middlwares[i])).toBe(true));
      [0, 1, 2].forEach((i) => expect(middlwares[3].calledAfter(middlwares[i])).toBe(true));
      [0, 1].forEach((i) => expect(middlwares[2].calledAfter(middlwares[i])).toBe(true));
      [0].forEach((i) => expect(middlwares[1].calledAfter(middlwares[i])).toBe(true));
    });
  });
});
