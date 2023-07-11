import joi from "joi";

export const namingConventions = joi.object().keys({
  stack: joi.string().optional(),
  api: joi.string().optional(),
  iam: joi.string().optional(),
  handlers: joi.string().optional(),
}).optional();
