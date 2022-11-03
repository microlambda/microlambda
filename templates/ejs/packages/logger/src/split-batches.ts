export const splitBatches = (array: any[], size: number): any[][] => {
  const batches = [];
  let start = 0;
  let end = 0;
  while (end != null) {
    end = end + size > array.length ? undefined : end + size;
    const slice = array.slice(start, end);
    batches.push(slice);
    start += size;
  }
  return batches;
};
