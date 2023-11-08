import joi from 'joi';

export const secretsConfig = joi.array().items(
  joi.object().keys({
    name: joi.string().required(),
    value: joi.string().required(),
    description: joi.string().optional(),
    kmsKeyId: joi.string().optional(),
  }),
);
