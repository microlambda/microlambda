import { IMetadata } from '@dataportal/types';
import { APIGatewayEvent } from 'aws-lambda';

import { deserializeURIObject, queryStringParametersDecoder, serializeURIObject } from '../../src';

describe('Test query-parameter', () => {
  const metadata: IMetadata = {
    limit: 5,
  };
  const serializedMetadata = 'eyJsaW1pdCI6NX0='; // {  limit: 5 }; serialized
  const mockedAPIGatewayEvent: Partial<APIGatewayEvent> = {
    queryStringParameters: {
      limit: '5',
    },
  };

  describe('Test queryStringParametersDecoder', () => {
    it('should return the query parameters', () => {
      expect(queryStringParametersDecoder(mockedAPIGatewayEvent as APIGatewayEvent)('limit')).toBe('5');
    });
    it('should return null', () => {
      expect(queryStringParametersDecoder({} as APIGatewayEvent)('limit')).toBe(null);
    });
  });

  describe('Test deserializeURIObject', () => {
    it('should return the deserialized data', () => {
      expect(deserializeURIObject(serializedMetadata)).toEqual(metadata);
    });
  });

  describe('Test serializeURIObject', () => {
    it('should return the data serialized parameters', () => {
      expect(serializeURIObject(metadata)).toEqual('eyJsaW1pdCI6NX0=');
    });
    it('should return null', () => {
      expect(serializeURIObject({})).toBe('e30=');
    });
  });
});
