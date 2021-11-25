export const interpolate = (str: string, inputs: Record<string, unknown>): string => {
  let interpolated = str;
  const matches = interpolated.matchAll(/\${input:([a-zA-Z0-9_-]+)}/g);
  for (const match of matches) {
    interpolated = interpolated.replace(match[0], inputs[match[1]].toString());
  }
  return interpolated;
};
