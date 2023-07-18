import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { maxAttempts } from '../max-attempts';
import { Readable } from 'stream';

export const downloadBuffer = async (bucket: string, key: string, region: string): Promise<Buffer | null> => {
  const client = new S3Client({ region, maxAttempts: maxAttempts() });
  const chunks: Uint8Array[] = [];
  const handleDownloadStream = (stream: Readable): Promise<void> =>
    new Promise((resolve, reject) => {
      stream.on('data', (chunk: Uint8Array) => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve());
    });
  const { Body } = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  );
  if (!Body) {
    return null;
  }
  await handleDownloadStream(Body as Readable);
  return Buffer.concat(chunks);
};

export const downloadStream = async (bucket: string, key: string, region: string): Promise<Readable> => {
  const client = new S3Client({ region, maxAttempts: maxAttempts() });
  const { Body } = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  );
  return Body as Readable;
};
