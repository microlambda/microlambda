import { splitBatches } from '../../src';

describe('Test splitBatches', () => {
  const hugeArray: string[] = Array(99).fill('testData');

  it('Should return a nested array with four elements', () => {
    expect(splitBatches(hugeArray, 25).length).toBe(4);
  });

  it('Should return a nested array with a hundred elements', () => {
    expect(splitBatches(hugeArray, 1).length).toBe(100);
  });

  it('Should return a nested array with a two elements', () => {
    expect(splitBatches(hugeArray, 50).length).toBe(2);
  });
});
