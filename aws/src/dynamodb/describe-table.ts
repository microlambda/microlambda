import { DynamoDBClient, DescribeTableCommand, DescribeTableOutput } from '@aws-sdk/client-dynamodb';

export const describeTable = async (region: string, tableName: string): Promise<DescribeTableOutput> => {
  const client = new DynamoDBClient({ region });
  return client.send(new DescribeTableCommand({ TableName: tableName }));
};
