import { cleanEmptyKeys } from '../../src';

describe('Test cleanEmptyKeys', () => {
  const object = {
    emptyKey: undefined as any,
    filledKey: 'MyKeyIsNotEmpty',
  };

  const nestedObject = {
    emptyKey: undefined as any,
    filledKey: object,
  };

  const simpleObjectWithArray = {
    emptyKey: undefined as any,
    filledKey: [object],
  };

  const simpledObjectWithNestedArray = {
    emptyKey: undefined as any,
    filledKey: simpleObjectWithArray,
  };

  it('Should return a clean object - object', () => {
    expect(cleanEmptyKeys(object)).toEqual({
      filledKey: 'MyKeyIsNotEmpty',
    });
  });

  it('Should return a clean object - nested object', () => {
    expect(cleanEmptyKeys(nestedObject)).toEqual({
      filledKey: {
        filledKey: 'MyKeyIsNotEmpty',
      },
    });
  });

  it('Should return an empty object - empty object', () => {
    expect(cleanEmptyKeys({})).toEqual({});
  });

  it('Should return a clean object - object with array of object', () => {
    expect(cleanEmptyKeys(simpleObjectWithArray)).toEqual({
      filledKey: [
        {
          filledKey: 'MyKeyIsNotEmpty',
        },
      ],
    });
  });

  it('Should return a clean object - object with array of nested object', () => {
    expect(cleanEmptyKeys(simpledObjectWithNestedArray)).toEqual({
      filledKey: {
        filledKey: [
          {
            filledKey: 'MyKeyIsNotEmpty',
          },
        ],
      },
    });
  });

  it('Should throw an error - null object', () => {
    try {
      cleanEmptyKeys(null);
      fail('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
    }
  });

  it('Should throw an error - undefined object', () => {
    try {
      fail('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
    }
  });
});
