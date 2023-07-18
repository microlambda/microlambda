import { aws } from '@microlambda/aws';
import { IRootConfig } from '@microlambda/config';

const keySchemaEquals = (
  actual?: Array<{ KeyType: 'HASH' | 'RANGE' | string | undefined; AttributeName: string | undefined }>,
  expected = '',
): boolean => {
  const [expectedHash, expectedRange] = expected.split(',');
  const actualHash = actual?.find((k) => k.KeyType === 'HASH')?.AttributeName;
  const actualRange = actual?.find((k) => k.KeyType === 'RANGE')?.AttributeName;
  return expectedHash === actualHash && expectedRange === actualRange;
};

export const verifyStateKeysSchema = async (config: IRootConfig): Promise<boolean> => {
  const metadata = await aws.dynamodb.describeTable(config.defaultRegion, config.state.table);
  const checkKeys = metadata?.Table?.KeySchema?.length === 2 && keySchemaEquals(metadata?.Table?.KeySchema, 'k1,k2');
  const checkGSIs =
    metadata.Table?.GlobalSecondaryIndexes?.length === 3 &&
    keySchemaEquals(
      metadata.Table?.GlobalSecondaryIndexes.find((gsi) => gsi.IndexName === 'GS1')?.KeySchema,
      'k2,k1',
    ) &&
    keySchemaEquals(
      metadata.Table?.GlobalSecondaryIndexes.find((gsi) => gsi.IndexName === 'GS2')?.KeySchema,
      'k3,k2',
    ) &&
    keySchemaEquals(metadata.Table?.GlobalSecondaryIndexes.find((gsi) => gsi.IndexName === 'GS3')?.KeySchema, 'k4,k2');
  return checkKeys && checkGSIs;
};
