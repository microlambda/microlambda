import { bucketExists } from './bucket-exists';
import { createBucket } from './create-bucket';
import { downloadStream } from './download-stream';
import { putObject } from './put-object';
import { deleteObject } from './delete-object';

export const s3 = {
  bucketExists,
  createBucket,
  downloadStream,
  putObject,
  deleteObject,
};
