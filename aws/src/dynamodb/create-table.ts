import { DynamoDBClient, CreateTableCommand, CreateTableOutput, CreateTableInput } from '@aws-sdk/client-dynamodb';

export const createTable = async (region: string, options: CreateTableInput): Promise<CreateTableOutput> => {
  const client = new DynamoDBClient({ region });
  return client.send(new CreateTableCommand(options));
};
