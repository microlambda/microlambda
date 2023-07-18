import { aws } from '@microlambda/aws';
import { IRootConfig } from '@microlambda/config';

export const createStateTable = async (config: IRootConfig): Promise<void> => {
  await aws.dynamodb.createTable(config.defaultRegion, {
    TableName: config.state.table,
    BillingMode: 'PAY_PER_REQUEST',
    AttributeDefinitions: [
      { AttributeName: 'k1', AttributeType: 'S' },
      { AttributeName: 'k2', AttributeType: 'S' },
      { AttributeName: 'k3', AttributeType: 'S' },
      { AttributeName: 'k4', AttributeType: 'S' },
    ],
    KeySchema: [
      { KeyType: 'HASH', AttributeName: 'k1' },
      { KeyType: 'RANGE', AttributeName: 'k2' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'GS1',
        KeySchema: [
          { KeyType: 'HASH', AttributeName: 'k2' },
          { KeyType: 'RANGE', AttributeName: 'k1' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
      {
        IndexName: 'GS2',
        KeySchema: [
          { KeyType: 'HASH', AttributeName: 'k3' },
          { KeyType: 'RANGE', AttributeName: 'k2' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
      {
        IndexName: 'GS3',
        KeySchema: [
          { KeyType: 'HASH', AttributeName: 'k4' },
          { KeyType: 'RANGE', AttributeName: 'k2' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
  });
};
