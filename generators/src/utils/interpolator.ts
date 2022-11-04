export const interpolate = (str: string, inputs: Record<string, unknown>): string => {
  let interpolated = str;
  const matches = interpolated.matchAll(/\${input:([.a-zA-Z0-9_-]+)}/g);
  for (const match of matches) {
    let value: unknown = inputs;
    const attrs = match[1].split('.');
    for (const attr of attrs) {
      if (typeof value !== 'object' || !Object.keys(value).includes(attr)) {
        throw new Error(`Incorrect JSON path ${match[1]}`);
      }
      value = (value as Record<string, unknown>)[attr];
    }
    if (typeof value !== 'string') {
      throw new Error(`Incorrect JSON path ${match[1]}`);
    }
    interpolated = interpolated.replace(match[0], value);
  }
  return interpolated;
};
