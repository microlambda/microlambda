export const assign = (
  obj: { [key: string]: any },
  path: string,
  value: any,
): void => {
  const segments = path.split('.');
  let ref: any = obj;
  for (const segment of segments.slice(0, segments.length - 1)) {
    if (!ref[segment]) {
      ref[segment] = {};
    }
    ref = ref[segment];
  }
  ref[segments[segments.length - 1]] = value;
};
