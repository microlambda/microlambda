import { IMetadata } from '@dataportal/types';
import { buildPaginatedResponse, deserializeMetadata, serializeMetadata } from '../../src';

describe('Test pagination', () => {
  const metadata: IMetadata = {
    limit: 5,
  };
  const serializedMetadata = 'eyJsaW1pdCI6NX0='; // {  limit: 5 }; serialized

  describe('Test deserializeMetadata', () => {
    it('Should deserialize the metadata', () => {
      expect(deserializeMetadata(serializedMetadata)).toEqual(metadata);
    });
  });

  describe('Test serializeMetadata', () => {
    it('Should serialize the metadata', () => {
      expect(serializeMetadata(metadata)).toBe(serializedMetadata);
    });
  });

  describe('Test buildPaginatedResponse', () => {
    it('Should return a paginated response', () => {
      const testData = [{ test: 'test' }];
      expect(buildPaginatedResponse(testData, metadata)).toEqual({ data: testData, metadata: serializedMetadata });
    });
  });
});
