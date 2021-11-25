import joi from 'joi';
import { dump, load } from 'js-yaml';
import { interpolate } from './interpolator';

export interface IInterpolatedYaml {
  name: string;
  description?: string;
  destination: string;
}

const validateYaml = (raw: unknown): IInterpolatedYaml => {
  const schema = joi.object().keys({
    name: joi.string().required(),
    description: joi.string().optional(),
    destination: joi.string().required(),
  });
  const { error, value } = schema.validate(raw);
  if (error) {
    throw error;
  }
  return value;
};

export const interpolateYaml = (yaml: unknown, inputs: Record<string, unknown>): IInterpolatedYaml => {
  let str = dump(yaml);
  str = interpolate(str, inputs);
  return validateYaml(load(str));
};
