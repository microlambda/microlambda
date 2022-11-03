import { mockEvent } from '../../../../services/auth/test/mocks/mocked-event';
import { getHeader } from '../../src';

describe('Test getHeader', () => {
  it('should return header with the same name [case 1]', () => {
    expect(
      getHeader(
        mockEvent({
          'My-Super-Awesome-Custom-Header': 'foobar',
        }),
        'My-Super-Awesome-Custom-Header',
      ),
    ).toBe('foobar');
  });
  it('should return header with the same name [case 2]', () => {
    expect(
      getHeader(
        mockEvent({
          'my-super-awesome-custom-Header': 'foobar',
        }),
        'MY-Super-AWESOME-Custom-HEADER',
      ),
    ).toBe('foobar');
  });
  it('should return header with the same name [case 3]', () => {
    expect(
      getHeader(
        mockEvent({
          'My-Super-Awesome-Custom-Header': 'foobar',
        }),
        'my-super-awesome-custom-header',
      ),
    ).toBe('foobar');
  });
  it('should return null if header is absent', () => {
    expect(
      getHeader(
        mockEvent({
          'My-Super-Awesome-Other-Custom-Header': 'foobar',
        }),
        'My-Super-Awesome-Custom-Header',
      ),
    ).toBe(null);
  });
});
