import { HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { getRegion } from '../get-region';

export const bucketExists = async (bucketName: string ): Promise<boolean> => {
  const client = new S3Client({ region: getRegion() });
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucketName }));
    return true;
  } catch (e) {
    if ((e as { $metadata: { httpStatusCode: number }}).$metadata.httpStatusCode === 404) {
      return false;
    }
    throw e;
  }
}
