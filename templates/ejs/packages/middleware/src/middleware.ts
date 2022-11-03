import { Lambda } from 'aws-sdk';
import { APIGatewayProxyResult } from 'aws-lambda';

import { IMiddleware, MiddlewareType } from '@dataportal/types';
import { MiddlewareModel } from '@dataportal/models';

import { ApiHandlerEvent, ApiHandleContext } from '@microlambda/handling';
import { logger, sendMessageToQueue } from '@dataportal/shared';
import { serializeError } from 'serialize-error';

const MAX_DISPLAYED_PAYLOAD_LENGTH = 50;

// Some headroom (262144 bytes max for total payload)
const MAX_PAYLOAD_RESPONSE_BODY_LENGTH = 50000;

const middlewareModel: MiddlewareModel = new MiddlewareModel();

export const callCustomHandler = async (
  middleware: IMiddleware,
  event: ApiHandlerEvent,
  context?: ApiHandleContext,
  result?: APIGatewayProxyResult,
  error?: Error,
): Promise<void> => {
  // Copy response that will be cropped to avoid modifying actual response
  const clonedResponse: APIGatewayProxyResult = JSON.parse(JSON.stringify(result));

  // Generating
  const objectPayload =
    middleware.type === 'before'
      ? { request: event, context: context, region: process.env.AWS_REGION }
      : middleware.type === 'after'
      ? { request: event, response: clonedResponse, region: process.env.AWS_REGION }
      : { request: event, error, response: clonedResponse, region: process.env.AWS_REGION };

  // Cropping payload body response
  if (objectPayload.response) {
    objectPayload.response.body =
      objectPayload.response.body?.slice(0, MAX_PAYLOAD_RESPONSE_BODY_LENGTH) + '... (cropped)';
  }

  const payload = JSON.stringify(objectPayload);

  logger.debug('Calling pluggable middleware', {
    middleware,
    region: middleware.region || process.env.MIDDLEWARE_DEFAULT_REGION,
    payload: payload.slice(0, MAX_DISPLAYED_PAYLOAD_LENGTH) + '... (cropped)',
  });

  const lambda = new Lambda({ region: middleware.region || process.env.MIDDLEWARE_DEFAULT_REGION });

  // call the corresponding handler
  await lambda
    .invoke({
      FunctionName: middleware.pk,
      Payload: payload,
      InvocationType: 'Event',
    })
    .promise()
    .catch((e) => {
      logger.error('Invocation failed !', { name: middleware.pk, e });
      sendMessageToQueue({ name: middleware.pk, error: serializeError(e) }, process.env.MIDDLEWARE_ERROR_QUEUE);
    });
};

export const getMiddlewareRegistered = async (type: MiddlewareType): Promise<IMiddleware[]> => {
  return middlewareModel.listByType(type);
};

export const groupByPriority = (middlewares: IMiddleware[]): IMiddleware[][] => {
  const comparePriority = (first: IMiddleware, second: IMiddleware): number => {
    return first.priority > second.priority ? 1 : first.priority < second.priority ? -1 : 0;
  };
  const middlewaresRegistered = middlewares.sort(comparePriority);
  const middlewaresRegisteredGrouped: IMiddleware[][] = [];
  if (middlewaresRegistered.length === 0) {
    return middlewaresRegisteredGrouped;
  } else {
    middlewaresRegisteredGrouped.push([middlewaresRegistered[0]]);
    if (middlewaresRegistered.length > 1) {
      for (let index = 1; index < middlewaresRegistered.length; ++index) {
        const current = middlewaresRegistered[index];
        if (current.priority !== middlewaresRegistered[index - 1].priority) {
          middlewaresRegisteredGrouped.push([current]);
        } else {
          middlewaresRegisteredGrouped[middlewaresRegisteredGrouped.length - 1].push(current);
        }
      }
    }
  }
  return middlewaresRegisteredGrouped;
};
