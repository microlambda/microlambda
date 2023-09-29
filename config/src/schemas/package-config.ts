import joi from 'joi';
import { targetsConfigSchema } from './target-config';
import { regions } from '../regions';

export const packageConfigSchema = joi.object().keys({
  extends: joi.string().optional(),
  targets: targetsConfigSchema.optional(),
  sharedInfra: joi
    .object()
    .keys({
      envSpecific: joi.boolean().optional(),
    })
    .optional(),
  ports: joi
    .alternatives(
      joi.number().port().optional(),
      joi.object().keys({
        http: joi.number().port().optional(),
        lambda: joi.number().port().optional(),
        websocket: joi.number().port().optional(),
      }),
    )
    .optional(),
  regions: joi
    .array()
    .items(
      joi
        .string()
        .valid(...regions)
        .required(),
    )
    .optional(),
});
