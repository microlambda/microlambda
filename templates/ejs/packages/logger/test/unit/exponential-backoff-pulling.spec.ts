import { spy } from 'sinon';

import { executeWithCustomExponentialBackoff } from '../../src';

describe('Test executeWithCustomExponentialBackoff', () => {
  let errorThrowingFctSpy: any;
  let successFctSpy: any;

  const basicTestFunction = async (): Promise<any> => {
    return 'success';
  };
  const errorThrowingTestFunction = async (): Promise<any> => {
    throw 'errorMessage';
  };

  beforeEach(() => {
    successFctSpy = spy(basicTestFunction);
    errorThrowingFctSpy = spy(errorThrowingTestFunction);
  });

  it('Should return a void Promise', async () => {
    const result = await executeWithCustomExponentialBackoff(successFctSpy);

    expect(successFctSpy.callCount).toBe(1);
    expect(successFctSpy.exceptions[0]).toBeUndefined();
    expect(result).toBeUndefined();
  });

  it('Should throw an error after one try', async () => {
    try {
      await executeWithCustomExponentialBackoff(errorThrowingFctSpy, 35);
      fail('should throw');
    } catch (e) {
      expect(errorThrowingFctSpy.callCount).toBe(1);
      expect(e).toBe('errorMessage');
    }
  });

  it('Should throw an error after thirty-two tries', async () => {
    try {
      await executeWithCustomExponentialBackoff(errorThrowingFctSpy);
      fail('should throw');
    } catch (e) {
      expect(errorThrowingFctSpy.callCount).toBe(32);
      expect(e).toBe('errorMessage');
    }
  }, 50000);
});
