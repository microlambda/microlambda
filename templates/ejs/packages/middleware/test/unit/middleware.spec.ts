import { groupByPriority } from '../../src/middleware';
import { IMiddleware } from '@dataportal/types';

describe('The group by priority function', () => {
  it('should return empty array if empty array received', () => {
    expect(groupByPriority([])).toEqual([]);
  });
  it('should group by priority', () => {
    const middleware: IMiddleware[] = [
      {
        pk: 'foobar',
        sk: 'middleware|before',
        type: 'before',
        priority: 4,
      },
      {
        pk: 'bar',
        sk: 'middleware|before',
        type: 'before',
        priority: 1235,
      },
      {
        pk: 'foo',
        sk: 'middleware|before',
        type: 'before',
        priority: 1,
      },

      {
        pk: 'baz',
        sk: 'middleware|before',
        type: 'before',
        priority: 3,
      },
      {
        pk: 'bang',
        sk: 'middleware|before',
        type: 'before',
        priority: 1235,
      },
      {
        pk: 'foobaz',
        sk: 'middleware|before',
        type: 'before',
        priority: 3,
      },
    ];
    const result = groupByPriority(middleware);
    expect(result.length).toBe(4);
    expect(result[0].length).toBe(1);
    expect(result[0].map((m) => m.pk).includes('foo')).toBe(true);
    expect(result[1].length).toBe(2);
    expect(result[1].map((m) => m.pk).includes('baz')).toBe(true);
    expect(result[1].map((m) => m.pk).includes('foobaz')).toBe(true);
    expect(result[2].length).toBe(1);
    expect(result[2].map((m) => m.pk).includes('foobar')).toBe(true);
    expect(result[3].length).toBe(2);
    expect(result[3].map((m) => m.pk).includes('bang')).toBe(true);
    expect(result[3].map((m) => m.pk).includes('bar')).toBe(true);
  });
});
