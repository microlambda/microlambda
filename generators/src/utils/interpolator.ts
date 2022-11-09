const isPrimitive = (value: unknown): boolean => {
  return ['number', 'boolean', 'string'].includes(typeof value);
}

export const interpolate = (str: string, inputs: Record<string, unknown>): string => {
  let interpolated = str;
  const matches = interpolated.matchAll(/\${input\.([.a-zA-Z0-9_-]+)}/g);
  for (const match of matches) {
    let value: unknown = inputs;
    const attrs = match[1].split('.');
    for (const attr of attrs) {
      if (typeof value !== 'object' || !Object.keys(value).includes(attr)) {
        throw new Error(`Incorrect JSON path: ${match[1]} does not exist`);
      }
      value = (value as Record<string, unknown>)[attr];
    }
    if (!isPrimitive(value)) {
      throw new Error(`Incorrect JSON path: ${match[1]} is not a primitive`);
    }
    interpolated = interpolated.replace(match[0], value.toString());
  }
  return interpolated;
};
