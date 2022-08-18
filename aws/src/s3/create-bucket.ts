import { CreateBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { getRegion } from '../get-region';

export const createBucket = async (bucketName: string ): Promise<void> => {
  const client = new S3Client({ region: getRegion() });
  await client.send(new CreateBucketCommand({ Bucket: bucketName }));
}
