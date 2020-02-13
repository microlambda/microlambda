import { ApiHandlerEvent, handle } from 'node-serverless-helpers';
import { logger } from '@project/shared';
import { sayHello } from '@project/greet';

export const handler = handle(async (event: ApiHandlerEvent) => {
  logger.debug('Hello Event receved', event);
  return sayHello(event.queryStringParameters ? event.queryStringParameters.lang : null);
});
