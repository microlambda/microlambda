import { SchemaLike, validate as joi } from 'joi';

export const validate = async <T>(data: T, schema: SchemaLike): Promise<T> => {
  const result = joi(data, schema);
  if (result.error) {
    throw result.error;
  }

  return result.value;
};
