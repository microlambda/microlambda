import joi from 'joi';
import { targetsConfigSchema } from './target-config';
import { regions } from '../regions';

export const packageConfigSchema = joi.object().keys({
  extends: joi.string().optional(),
  targets: targetsConfigSchema.optional(),
  regions: joi.array().items(joi.string().valid(...regions).required()).optional(),
})
