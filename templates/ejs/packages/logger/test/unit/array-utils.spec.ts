import { isOneElementIsIncluded } from '../../src';

describe('Test isOneElementIsIncluded', () => {
  const arrayOfValues = ['validValue1', 'validValue2', 'anotherValue'];

  it('Should return true (valid)', () => {
    expect(isOneElementIsIncluded(['validValue1', 'anotherValue'], arrayOfValues)).toBeTruthy();
  });

  it('Should return false (invalid) with wrong value', () => {
    expect(isOneElementIsIncluded(['not-valid-value'], arrayOfValues)).toBeFalsy();
  });

  it('Should return false (invalid) with array containing null', () => {
    expect(isOneElementIsIncluded([null], arrayOfValues)).toBeFalsy();
  });

  it('Should return false (invalid) with an array containing an empty string', () => {
    expect(isOneElementIsIncluded([''], arrayOfValues)).toBeFalsy();
  });

  it('Should return false (invalid) with an array containing undefined', () => {
    expect(isOneElementIsIncluded([undefined], arrayOfValues)).toBeFalsy();
  });

  it('Should return false (invalid) with empty array', () => {
    expect(isOneElementIsIncluded([], arrayOfValues)).toBeFalsy();
  });
});
