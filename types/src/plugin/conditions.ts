interface IConditionKeepEquals {
  keep: string;
  when: string;
  eq: string;
}

interface IConditionRemoveEquals {
  remove: string;
  when: string;
  eq: string;
}

interface IConditionKeepNotEquals {
  keep: string;
  when: string;
  neq: string;
}

interface IConditionRemoveNotEquals {
  remove: string;
  when: string;
  neq: string;
}

export type Condition =
  | IConditionKeepEquals
  | IConditionKeepNotEquals
  | IConditionRemoveEquals
  | IConditionRemoveNotEquals;

// Type guards
export const isRemoveEqCondition = (condition: Condition): condition is IConditionRemoveEquals => {
  return !!(condition as IConditionRemoveEquals).remove && !!(condition as IConditionRemoveEquals).eq;
};

export const isRemoveNeqCondition = (condition: Condition): condition is IConditionRemoveNotEquals => {
  return !!(condition as IConditionRemoveNotEquals).remove && !!(condition as IConditionRemoveNotEquals).neq;
};

export const isKeepEqCondition = (condition: Condition): condition is IConditionKeepEquals => {
  return !!(condition as IConditionKeepEquals).keep && !!(condition as IConditionKeepEquals).eq;
};

export const isKeepNeqCondition = (condition: Condition): condition is IConditionKeepNotEquals => {
  return !!(condition as IConditionKeepNotEquals).keep && !!(condition as IConditionKeepNotEquals).neq;
};
