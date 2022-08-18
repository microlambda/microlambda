import { APIGatewayProxyResult } from 'aws-lambda';
import * as AWS from 'aws-sdk';

import { after, ApiHandlerEvent, before, config, handleError, ApiHandleContext } from '@microlambda/handling';

import { callCustomHandler, groupByPriority, getMiddlewareRegistered } from './middleware';
import { decryptServiceSecrets } from './secrets';
import { logger } from '@dataportal/shared';

/**
 * Very important method !
 * This init method aim to perform general action for API Gateway handler:
 * - Configure CORS
 * - Parse authorizer response
 * - Decrypt AWS secrets (api keys, ...)
 */

export const middleware = async (serviceName?: string): Promise<void> => {
  /* configuring CORS (to move to DP specific ?) */

  logger.debug(`[Init] Running ${serviceName || 'default'} init function`);
  AWS.config.update({ region: 'eu-west-1' });
  logger.debug('Init cors', { cors: true, blacklist: [] });
  config({ api: { cors: true, blacklist: [] } });

  /* declaring by default the first middleware before-functions to set */

  const parseCurrentUser = async (event: ApiHandlerEvent, _context: ApiHandleContext): Promise<void> => {
    logger.debug('User authenticated', event.requestContext.authorizer);
    const currentUser = event.requestContext.authorizer?.currentUser;
    if (typeof currentUser === 'string') {
      event.requestContext.authorizer.currentUser = JSON.parse(currentUser);
    }
  };

  const decryptSecrets = async (_event: ApiHandlerEvent, _context: ApiHandleContext): Promise<void> =>
    decryptServiceSecrets(serviceName);

  /* setting up every middlewares */

  // before
  const pluggableMiddlewareBefore = async (event: ApiHandlerEvent, context: ApiHandleContext): Promise<void> => {
    if (process.env.NODE_ENV !== 'test') {
      try {
        logger.debug('Calling before pluggable middleware');
        const beforeMiddlewaresRegistered = await getMiddlewareRegistered('before');
        logger.debug('Reading registered middleware from database', beforeMiddlewaresRegistered);
        const beforeMiddlewaresGrouped = groupByPriority(beforeMiddlewaresRegistered);
        logger.debug('Grouping by priority', beforeMiddlewaresGrouped);
        for (const middlewaresSamePriority of beforeMiddlewaresGrouped) {
          await Promise.all(
            middlewaresSamePriority.map((middlewareSamePriority) =>
              callCustomHandler(middlewareSamePriority, event, context),
            ),
          );
        }
      } catch (e) {
        logger.error('An error occurred calling after middleware');
        logger.error(e);
      }
    }
  };
  const beforeMiddlewareFunctions = [parseCurrentUser, decryptSecrets, pluggableMiddlewareBefore]; // by default

  // after
  const pluggableMiddlewareAfter = async (event: ApiHandlerEvent, result: APIGatewayProxyResult): Promise<void> => {
    if (process.env.NODE_ENV !== 'test') {
      try {
        const afterMiddlewaresRegistered = await getMiddlewareRegistered('after');
        const afterMiddlewaresGrouped = groupByPriority(afterMiddlewaresRegistered);
        for (const middlewaresSamePriority of afterMiddlewaresGrouped) {
          await Promise.all(
            middlewaresSamePriority.map((middlewareSamePriority) =>
              callCustomHandler(middlewareSamePriority, event, undefined, result),
            ),
          );
        }
      } catch (e) {
        logger.error('An error occurred calling after middleware');
        logger.error(e);
      }
    }
  };
  const afterMiddlewareFunctions = [pluggableMiddlewareAfter];

  const logError = async (event: ApiHandlerEvent, error: Error, result: APIGatewayProxyResult): Promise<void> => {
    logger.error('Uncaught error in handler execution !');
    logger.error(error);
    logger.debug('Invocation context', { event, result });
  };

  // error
  const pluggableMiddlewareError = async (
    event: ApiHandlerEvent,
    error: Error,
    result: APIGatewayProxyResult,
  ): Promise<void> => {
    if (process.env.NODE_ENV !== 'test') {
      try {
        const errorMiddlewaresRegistered = await getMiddlewareRegistered('error');
        const errorMiddlewaresGrouped = groupByPriority(errorMiddlewaresRegistered);
        for (const middlewaresSamePriority of errorMiddlewaresGrouped) {
          await Promise.all(
            middlewaresSamePriority.map((middlewareSamePriority) =>
              callCustomHandler(middlewareSamePriority, event, undefined, result, error),
            ),
          );
        }
      } catch (e) {
        logger.error('An error occurred calling error middleware');
        logger.error(e);
      }
    }
  };
  const errorMiddlewareFunctions = [logError, pluggableMiddlewareError];

  /* calling sequentially every middleware functions following the array's order */

  const type = 'ApiGateway';
  before(type, beforeMiddlewareFunctions);
  after(type, afterMiddlewareFunctions);
  handleError(type, errorMiddlewareFunctions);
};
