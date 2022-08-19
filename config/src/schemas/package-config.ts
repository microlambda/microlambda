import joi from 'joi';
import { targetConfigSchema, targetsConfigSchema } from './target-config';

export const packageConfigSchema = joi.object().keys({
  extends: joi.string().optional(),
  targets: targetsConfigSchema.optional(),
})
