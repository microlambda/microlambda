import { IMetadata, IPaginatedResult } from '@dataportal/types';
import { deserializeURIObject, serializeURIObject } from './query-parameters';

export const deserializeMetadata = (metadata: string): IMetadata => deserializeURIObject<IMetadata>(metadata);

export const serializeMetadata = (metadata: IMetadata): string => serializeURIObject<IMetadata>(metadata);

export const buildPaginatedResponse = <T>(data: T[], metadata: IMetadata): IPaginatedResult<T> => {
  return {
    data,
    metadata: serializeMetadata(metadata),
  };
};
