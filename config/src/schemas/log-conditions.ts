import joi from 'joi';

export const logConditionsSchema = joi.object().keys({
  type: joi.string().valid('success', 'failure').required(),
  stdio: joi.string().valid('stdout', 'stderr', 'all').required(),
  matcher: joi.string().valid('contains', 'regex').required(),
  value: joi.string().required(),
  timeout: joi.number().optional(),
});
