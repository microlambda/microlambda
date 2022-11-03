import { DynamoDB } from 'aws-sdk';

const getParams = (): DynamoDB.Types.ClientConfiguration => {
  const isLocal = process.env.env === 'test' && process.env.LOCAL_DYNAMODB_PORT;
  return isLocal
    ? {
        region: 'localhost',
        endpoint: `http://localhost:${process.env.LOCAL_DYNAMODB_PORT}`,
      }
    : { region: process.env.AWS_REGION === 'localhost' ? 'eu-west-1' : process.env.AWS_REGION };
};

const getEuWestFixedParams = (): DynamoDB.Types.ClientConfiguration => {
  const isLocal = process.env.env === 'test' && process.env.LOCAL_DYNAMODB_PORT;
  return isLocal
    ? {
        region: 'localhost',
        endpoint: `http://localhost:${process.env.LOCAL_DYNAMODB_PORT}`,
      }
    : { region: 'eu-west-1' };
};

export const docClient = new DynamoDB.DocumentClient(getParams());
export const fixedEuWest1DocClient = new DynamoDB.DocumentClient(getEuWestFixedParams());
export const dynamoDB = new DynamoDB(getParams());
