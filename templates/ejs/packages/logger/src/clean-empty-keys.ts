export function cleanEmptyKeys<T>(object: T): T {
  Object.keys(object).forEach((key) => {
    if ((object as any)[key] === undefined) {
      delete (object as any)[key];
    }

    if (Array.isArray((object as any)[key])) {
      (object as any)[key] = (object as any)[key].map(cleanEmptyKeys);
    }

    if (typeof (object as any)[key] === 'object' && (object as any)[key] !== null) {
      (object as any)[key] = cleanEmptyKeys((object as any)[key]);
    }
  });

  return object;
}
