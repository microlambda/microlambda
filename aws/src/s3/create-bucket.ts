import { CreateBucketCommand, S3Client } from '@aws-sdk/client-s3';

export const createBucket = async (region: string, bucketName: string ): Promise<void> => {
  const client = new S3Client({ region });
  await client.send(new CreateBucketCommand({ Bucket: bucketName }));
}
