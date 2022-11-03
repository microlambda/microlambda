import { HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';

export const objectExists = async (region: string, bucketName: string, key: string ): Promise<boolean> => {
  const client = new S3Client({ region });
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucketName, Key: key }));
    return true;
  } catch (e) {
    if ((e as { $metadata: { httpStatusCode: number }}).$metadata.httpStatusCode === 404) {
      return false;
    }
    throw e;
  }
}
