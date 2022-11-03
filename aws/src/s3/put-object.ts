import {PutObjectCommand, S3Client} from "@aws-sdk/client-s3";
import {maxAttempts} from "../max-attempts";

export const putObject = async (bucket: string, key: string, data: string | Buffer, region: string): Promise<void> => {
  const client = new S3Client({ region, maxAttempts: maxAttempts() });
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Body: data,
    Key: key,
  }));
};
