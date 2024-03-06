import joi from 'joi';
import { regions } from '../regions';
import { targetsConfigSchema } from './target-config';

const region = joi.string().valid(...regions);

const stateConfig = joi.object().keys({
  checksums: joi.string().required(),
  table: joi.string().required(),
});
export const accountsSchema = joi.object().pattern(
  joi.string(),
  joi.object().keys({
    id: joi
      .string()
      .pattern(/^[0-9]{12}$/)
      .required(),
    defaultRegion: region.required(),
    state: stateConfig.required(),
  }),
);

const commonKeys = {
  defaultRuntime: joi
    .string()
    .pattern(/nodejs[0-9]{1,2}.x/)
    .optional(),
  targets: targetsConfigSchema.optional(),
};

export const rootConfigSchema = joi.alternatives(
  joi.object().keys({
    defaultRegion: region.required(),
    state: stateConfig.required(),
    ...commonKeys,
  }),
  joi.object().keys({
    accounts: accountsSchema.required(),
    ...commonKeys,
  }),
);
