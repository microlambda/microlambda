import {
  Condition,
  isKeepEqCondition,
  isKeepNeqCondition,
  isRemoveEqCondition,
  isRemoveNeqCondition,
  IBaseLogger,
  ServerlessInstance,
} from '@microlambda/types';

export const applyConditions = (
  serverless: ServerlessInstance,
  conditions: Condition[],
  logger: IBaseLogger,
): void => {
  const applyCondition = (
    resourcePath: string,
    removeCondition: boolean,
  ): void => {
    logger.info('Resolving resource', resourcePath);
    const resolveResource = (): {
      obj: Record<string, unknown>;
      lastKey: string;
    } => {
      const segments = resourcePath.split('.');
      const lastKey = segments.pop();
      if (!lastKey) {
        const msg = 'Assertion failed: last key should be truthy';
        logger.error(msg);
        throw new Error(msg);
      }
      let obj: Record<string, unknown> = serverless.service;
      const currentSegments: string[] = [];
      for (const segment of segments) {
        currentSegments.push(segment);
        obj = obj[segment] as Record<string, unknown>;
        if (!obj) {
          const msg = `ConditionException: Cannot resolve resource ${resourcePath}: object at ${currentSegments.join(
            '.',
          )} is not defined`;
          logger.error(msg);
          throw Error(msg);
        }
      }
      return { obj, lastKey };
    };
    const { obj, lastKey } = resolveResource();
    logger.debug('Resource resolved', { lastKey, value: obj[lastKey] });
    logger.debug('Should be removed ?', removeCondition);
    if (removeCondition) {
      delete obj[lastKey];
    }
  };
  for (const condition of conditions) {
    logger.info('Apply condition', condition);
    if (isKeepEqCondition(condition)) {
      applyCondition(condition.keep, condition.when !== condition.eq);
    } else if (isKeepNeqCondition(condition)) {
      applyCondition(condition.keep, condition.when === condition.neq);
    } else if (isRemoveEqCondition(condition)) {
      applyCondition(condition.remove, condition.when === condition.eq);
    } else if (isRemoveNeqCondition(condition)) {
      applyCondition(condition.remove, condition.when !== condition.neq);
    }
  }
};
