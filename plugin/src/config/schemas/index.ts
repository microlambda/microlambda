import joi from 'joi';
import { domainConfig } from './domain';
import { replaceAuthorizerConfig } from './authorizer-replace';
import { secretsConfig } from './secrets';
import { conditionsSchema } from './conditions';
import { packagrSchema } from './packagr';

export const configSchema = joi.object().keys({
  domain: domainConfig.optional(),
  localAuthorizer: joi
    .alternatives(
      replaceAuthorizerConfig,
      joi.array().items(replaceAuthorizerConfig),
    )
    .optional(),
  secrets: secretsConfig.optional(),
  conditions: conditionsSchema.optional(),
  transforms: joi.array().items(joi.string().required()).optional(),
  packagr: packagrSchema.optional(),
});
