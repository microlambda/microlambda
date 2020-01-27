import { ApiHandlerEvent, handle } from 'node-serverless-helpers';
import { logger } from '@project/shared';
import { sayHello } from '@project/greet';

export const handler = handle(async (event: ApiHandlerEvent) => {
  logger.debug('Event received', event);
  return sayHello(event.queryParameters ? event.queryParameters.lang : null);
});
