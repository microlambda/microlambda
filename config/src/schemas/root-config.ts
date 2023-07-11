import joi from 'joi';
import { regions } from '../regions';
import { targetsConfigSchema } from './target-config';

export const rootConfigSchema = joi.object().keys({
  defaultRegion: joi.string().valid(...regions).required(),
  defaultRuntime: joi.string().valid('nodejs12.x', 'nodejs14.x', 'nodejs16.x').required(),
  state: joi.object().keys({
    checksums: joi.string().required(),
    table: joi.string().required(),
  }).required(),
  sharedResources: joi.object().keys({
    shared: joi.string().optional(),
    env: joi.string().optional(),
  }).optional(),
  targets: targetsConfigSchema.optional(),
  deploymentRole: joi.string().optional(),
});
