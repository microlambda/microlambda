import joi from 'joi';

export const domainConfig = joi.object().keys({
  domainName: joi.string().required(),
  basePath: joi.string().optional(),
  type: joi.string().valid('rest', 'http', 'websocket').optional(),
});
