interface IValidationErrors {
  name: string;
  details: { message: string; path: string; type: string; context: { key: string } }[];
}

export const errorNotUnique = (field: string, path?: string): IValidationErrors => ({
  name: 'ValidationError',
  details: [
    {
      message: `"${field}" is not unique`,
      path: path || field,
      type: 'any.unique',
      context: {
        key: path || field,
      },
    },
  ],
});
