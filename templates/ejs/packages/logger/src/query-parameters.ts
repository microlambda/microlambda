import { APIGatewayEvent } from 'aws-lambda';

export const queryStringParametersDecoder = (event: APIGatewayEvent) => {
  return (key: string): string =>
    !!event.queryStringParameters && event.queryStringParameters[key] != null
      ? decodeURIComponent(event.queryStringParameters[key])
      : null;
};

const btoa = (toEncode: string): string => {
  return Buffer.from(toEncode, 'binary').toString('base64');
};

const atob = (encoded: string): string => {
  return Buffer.from(encoded, 'base64').toString('binary');
};

export const deserializeURIObject = <T>(metadata: string): T => {
  return JSON.parse(atob(decodeURIComponent(metadata)));
};

export const serializeURIObject = <T>(metadata: T): string => {
  return btoa(JSON.stringify(metadata));
};
