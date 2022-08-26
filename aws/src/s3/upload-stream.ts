import { Upload } from "@aws-sdk/lib-storage";
import { AbortMultipartUploadCommandOutput, CompleteMultipartUploadCommandOutput, S3Client } from "@aws-sdk/client-s3";
import { maxAttempts } from "../max-attempts";
import { PassThrough } from 'stream';
import { IBaseLogger } from '@microlambda/types';
import { Writable } from 'stream';

export const uploadStream = async (Bucket: string, Key: string, region: string, logger?: IBaseLogger): Promise<{ writeStream: Writable, done: Promise<AbortMultipartUploadCommandOutput | CompleteMultipartUploadCommandOutput>}> => {
  const pass = new PassThrough();
  const upload = new Upload({
    client: new S3Client({ region: 'eu-west-1', maxAttempts: maxAttempts() }),
    params: { Bucket , Key, Body: pass }
  })
  upload.on('httpUploadProgress', (data) => logger?.debug(data));
  return {
    writeStream: pass,
    done: upload.done(),
  };
};
