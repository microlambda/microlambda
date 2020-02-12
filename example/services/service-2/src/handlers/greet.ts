import { ApiHandlerEvent, handle, validate } from 'node-serverless-helpers';
import Joi from '@hapi/joi';
import { greet } from '@project/greet';
import { logger } from '@project/shared';
import { IGreetEvent } from '@project/types';

export const handler = handle(async (event: ApiHandlerEvent<IGreetEvent>) => {
  logger.debug('Event receivdded', event);
  await validate<IGreetEvent>(
    event.body,
    Joi.object().keys({
      name: Joi.string().required(),
    }),
  );
  return greet(event.body.name, event.queryStringParameters ? event.queryStringParameters.lang : null);
});
