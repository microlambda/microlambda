import { logger } from '.';
import { S3Event } from 'aws-lambda';

export const extractPutEvent = (event: S3Event, regexp: RegExp): { bucket: string; match: boolean; key: string } => {
  logger.info('Received records from S3', JSON.stringify(event));
  const bucket = event.Records[0].s3.bucket.name;
  const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
  logger.info('Object uploaded in bucket', { bucket, key });
  logger.info('Check if key is matching', { regexp, match: key.match(regexp) });
  const match = key.match(regexp) && event.Records[0].eventName === 'ObjectCreated:Put';
  return { bucket, key, match };
};
