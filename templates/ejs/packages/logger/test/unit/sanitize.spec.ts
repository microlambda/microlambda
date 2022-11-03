import { filterXSS } from 'xss';
import { sanitizeObject } from '../../src';

describe('Test sanitizeObject', () => {
  const numberValue = 5;
  const safeString = 'safe string';
  const unsafeString = "<script>alert('unsafe')</script>";
  const sanitizedUnsafeString = filterXSS(unsafeString);

  const safeStringObject = {
    safeField: safeString,
  };

  const unsafeStringObject = {
    unsafeField: unsafeString,
  };

  const noStringObject = {
    nonStringField: numberValue,
  };

  const arrayObject = {
    arrayField: [safeString, unsafeString],
  };

  const nestedSafeFieldObject = {
    safeObject: safeStringObject,
  };

  const nestedUnsafeFieldObject = {
    unsafeObject: unsafeStringObject,
  };

  it('Should not affect safe string', () => {
    expect(sanitizeObject(safeString)).toEqual(safeString);
  });

  it('Should affect unsafe string', () => {
    expect(sanitizeObject(unsafeString)).toEqual(sanitizedUnsafeString);
  });

  it('Should not affect non-string', () => {
    expect(sanitizeObject(numberValue)).toEqual(numberValue);
  });

  it('Should not affect safe string field', () => {
    const sanitizedObject = sanitizeObject(safeStringObject);
    expect(sanitizedObject.safeField).toEqual(safeString);
  });

  it('Should sanitize unsafe string field', () => {
    const sanitizedObject = sanitizeObject(unsafeStringObject);
    expect(sanitizedObject.unsafeField).toEqual(sanitizedUnsafeString);
  });

  it('Should not affect non string field', () => {
    const sanitizedObject = sanitizeObject(noStringObject);
    expect(sanitizedObject.nonStringField).toEqual(numberValue);
  });

  it('Should affect only unsafe string in array field', () => {
    const sanitizedObject = sanitizeObject(arrayObject);
    expect(sanitizedObject.arrayField[0]).toEqual(safeString);
    expect(sanitizedObject.arrayField[1]).toEqual(sanitizedUnsafeString);
  });

  it('Should not affect safe string in nested object field', () => {
    const sanitizedObject = sanitizeObject(nestedSafeFieldObject);
    expect(sanitizedObject.safeObject.safeField).toEqual(safeString);
  });

  it('Should affect unsafe string in nested object field', () => {
    const sanitizedObject = sanitizeObject(nestedUnsafeFieldObject);
    expect(sanitizedObject.unsafeObject.unsafeField).toEqual(sanitizedUnsafeString);
  });
});
