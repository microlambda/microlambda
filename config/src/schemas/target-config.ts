import joi from 'joi';
import { logConditionsSchema } from './log-conditions';

const commandConfigSchema = joi.object().keys({
  run: joi.string().required(),
  env: joi.object().pattern(joi.string(), joi.string().required()).optional(),
  daemon: joi.alternatives(
    joi.boolean().valid(false).required(),
    logConditionsSchema.required(),
    joi.array().items(logConditionsSchema).required(),
  ).optional(),
});

const cachingSchema = joi.object().keys({
  src: joi.object().keys({
    internals: joi.array().items(joi.string().required()).optional(),
    deps: joi.array().items(joi.string().required()).optional(),
    root: joi.array().items(joi.string().required()).optional(),
  }).optional(),
  artifacts: joi.array().items(joi.string().required()).optional(),
});

export const targetConfigSchemaCmds = cachingSchema.keys({
  cmd: joi.alternatives(
    joi.string().required(),
    joi.array().items(joi.string().required()).required(),
    commandConfigSchema.required(),
    joi.array().items(commandConfigSchema.required()).required(),
  ),
});

export const targetConfigSchemaScript = cachingSchema.keys({
  script: joi.string().required(),
  env: joi.object().pattern(joi.string(), joi.string().required()).optional(),
  daemon: joi.alternatives(
    joi.boolean().valid(false).required(),
    logConditionsSchema.required(),
    joi.array().items(logConditionsSchema).required(),
  ).optional(),
});

export const targetsConfigSchema = joi.object().pattern(joi.string(), joi.alternatives(targetConfigSchemaCmds, targetConfigSchemaScript));
