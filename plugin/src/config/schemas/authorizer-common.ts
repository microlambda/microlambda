import joi from "joi";

export const authorizerConfigCommon = joi.object().keys({
  resultTtlInSeconds: joi.number().optional(),
  identitySource: joi.string().optional(),
  identityValidationExpression: joi.string().optional(),
  type: joi.string().valid("token", "request").optional(),
  remove: joi.boolean().optional(),
});
