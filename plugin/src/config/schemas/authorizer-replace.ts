import joi from 'joi';
import { authorizerConfig } from './authorizer';

export const replaceAuthorizerConfig = joi.object().keys({
  replace: authorizerConfig.required(),
  with: authorizerConfig.required(),
});
