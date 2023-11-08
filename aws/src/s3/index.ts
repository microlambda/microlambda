import { bucketExists } from './bucket-exists';
import { createBucket } from './create-bucket';
import { downloadBuffer, downloadStream } from './download-stream';
import { putObject } from './put-object';
import { deleteObject } from './delete-object';
import { uploadStream } from './upload-stream';
import { objectExists } from './key-exists';
import { emptyBucket } from './empty-bucket';

export const s3 = {
  bucketExists,
  createBucket,
  downloadStream,
  downloadBuffer,
  uploadStream,
  objectExists,
  putObject,
  emptyBucket,
  deleteObject,
};
