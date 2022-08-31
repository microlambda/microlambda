import { getDefaultThreads, getThreads } from '@microlambda/utils';

export const getConcurrency = (requested: string | undefined): number => {
  if (!requested || Number.isNaN(Number(requested))) {
    return getDefaultThreads();
  }
  return getThreads(Number(requested));
}
