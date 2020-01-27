import { ApiHandlerEvent, handle, validate } from 'node-serverless-helpers';
import Joi from '@hapi/joi';
import { greet } from '@project/greet';
import { logger } from '@project/shared';
import { IGreetEvent } from '@project/types';

export const handler = handle(async (event: ApiHandlerEvent<IGreetEvent>) => {
  logger.debug('Event received', event);
  await validate<IGreetEvent>(
    event.body,
    Joi.object().keys({
      name: Joi.string().required(),
    }),
  );
  return greet(event.name, event.queryParameters ? event.queryParameters.lang : null);
});
