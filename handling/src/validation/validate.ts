import { Schema } from '@hapi/joi';

export const validate = async <T>(data: T, schema: Schema): Promise<T> => {
  const result = schema.validate(data);
  if (result.error) {
    throw result.error;
  }

  return result.value;
};
