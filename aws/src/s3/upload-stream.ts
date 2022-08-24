import { Upload } from "@aws-sdk/lib-storage";
import { S3Client } from "@aws-sdk/client-s3";
import { maxAttempts } from "../max-attempts";
import { Readable } from 'stream';

export const uploadStream = async (bucket: string, key: string, data: Readable, region: string): Promise<void> => {
  const upload = new Upload({
    client: new S3Client({ region, maxAttempts: maxAttempts() }),
    params: { Bucket: bucket, Key: key, Body: data }
  })
  await upload.done();
};
