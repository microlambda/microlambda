import { SlugifyPipe } from '../../src';

describe('Test SlugifyPipe', () => {
  const testString = 'this ¶zas a SlUªg string ! ¼:)[=';
  const testStringSlugified = 'this-pzas-a-sluag-string-14';

  it('Should return a slugified string url', () => {
    expect(SlugifyPipe.transform(testString)).toBe(testStringSlugified);
  });

  it('Should return an empty string', () => {
    expect(SlugifyPipe.transform('                   ')).toBe('');
  });
});
