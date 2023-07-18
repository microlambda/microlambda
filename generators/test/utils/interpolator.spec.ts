import { interpolate } from '../../src/utils/interpolator';

const inputs = {
  foo: 'foo',
  bar: {
    baz: 42,
  },
};

describe('The interpolator method', () => {
  it('should interpolate correctly ${input.foo}', () => {
    expect(interpolate('Hello from ${input.foo} !', inputs)).toBe('Hello from foo !');
  });
  it('should interpolate correctly ${input.bar.baz}', () => {
    expect(interpolate('Hello from ${input.bar.baz} !', inputs)).toBe('Hello from 42 !');
  });
  it('should throw if JSON path is incorrect - not existing ${input.baz.foobar}', () => {
    try {
      expect(interpolate('Hello from ${input.baz.foobar} !', inputs)).toBe('Hello from foo !');
      fail('should fail');
    } catch (e) {
      expect((e as Error).message).toBe('Incorrect JSON path: baz.foobar does not exist');
    }
  });
  it('should throw if JSON path is incorrect - not a primitive ${input.bar}', () => {
    try {
      expect(interpolate('Hello from ${input.bar} !', inputs)).toBe('Hello from foo !');
      fail('should fail');
    } catch (e) {
      expect((e as Error).message).toBe('Incorrect JSON path: bar is not a primitive');
    }
  });
});
