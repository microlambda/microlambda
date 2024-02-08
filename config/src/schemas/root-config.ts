import joi from 'joi';
import { regions } from '../regions';
import { targetsConfigSchema } from './target-config';

export const rootConfigSchema = joi.object().keys({
  defaultRegion: joi
    .string()
    .valid(...regions)
    .required(),
  defaultRuntime: joi.string().valid('nodejs12.x', 'nodejs14.x', 'nodejs16.x').required(),
  state: joi
    .object()
    .keys({
      checksums: joi.string().required(),
      table: joi.string().required(),
    })
    .required(),
  targets: targetsConfigSchema.optional(),
  installedBlueprints: joi.array().items(joi.string()).optional(),
});
