import { bucketExists } from './bucket-exists';
import { createBucket } from './create-bucket';
import { downloadStream } from './download-stream';
import { putObject } from './put-object';

export const s3 = {
  bucketExists,
  createBucket,
  downloadStream,
  putObject,
};
