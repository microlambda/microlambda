import {DeleteObjectCommand, S3Client} from "@aws-sdk/client-s3";
import {maxAttempts} from "../max-attempts";

export const deleteObject = async (bucket: string, key: string, region: string): Promise<void> => {
  const client = new S3Client({ region, maxAttempts: maxAttempts() });
  await client.send(new DeleteObjectCommand({
    Bucket: bucket,
    Key: key,
  }));
};
