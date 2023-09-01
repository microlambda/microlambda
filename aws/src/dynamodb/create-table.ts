import {
  DynamoDBClient,
  CreateTableCommand,
  CreateTableOutput,
  CreateTableInput,
  DescribeTableCommand
} from '@aws-sdk/client-dynamodb';

export const createTable = async (region: string, options: CreateTableInput): Promise<CreateTableOutput> => {
  const client = new DynamoDBClient({ region });
  const output = await client.send(new CreateTableCommand(options));
  let isActive = false;
  while (!isActive) {
    const table = await client.send(new DescribeTableCommand({
      TableName: options.TableName,
    }));
    if (table.Table?.TableStatus === 'ACTIVE') {
      isActive = true;
    }
  }
  return output;
};
