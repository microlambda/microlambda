import { IBaseLogger, ServerlessInstance } from '@microlambda/types';

export const applyTransforms = (
  serverless: ServerlessInstance,
  transforms: string[] | undefined,
  logger: IBaseLogger,
): void => {
  logger.debug('NotImplemented', serverless, transforms);
  // Check if script at path exists

  // If .ts transpile it

  // Apply it (try/catch and re-trow properly)
};
