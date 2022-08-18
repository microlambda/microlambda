export const isOneElementIsIncluded = (testedArray: string[] | Set<string>, validValues: string[]): boolean => {
  for (const testedValue of testedArray) {
    if (validValues.includes(testedValue)) {
      return true;
    }
  }
  return false;
};
