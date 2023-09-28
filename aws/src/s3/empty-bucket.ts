import {DeleteObjectCommand, ListObjectsV2Command, S3Client} from '@aws-sdk/client-s3';
import { maxAttempts } from '../max-attempts';
import {ListObjectsV2CommandOutput} from "@aws-sdk/client-s3/dist-types/commands/ListObjectsV2Command";
import {IBaseLogger} from "@microlambda/types";

export const emptyBucket = async (params: { bucket: string, region: string }, logger?: IBaseLogger): Promise<void> => {
  const { bucket, region } = params;
  const client = new S3Client({ region, maxAttempts: maxAttempts() });
  let nextToken: string | undefined = undefined;
  const deletion$: Array<Promise<void>> = [];
  const errors: Array<{ object: string | undefined, error: unknown }> = [];
  do {
    const page: ListObjectsV2CommandOutput = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: nextToken,
      }),
    );
    nextToken = page.NextContinuationToken;
    if (page.Contents) {
      deletion$.push(...page.Contents.map(async (object) => {
        try {
          await client.send(new DeleteObjectCommand({
            Bucket: bucket,
            Key: object.Key,
          }));
        } catch (e) {
          logger?.error(e);
          errors.push({ object: object.Key, error: e });
        }
      }))
    }
  } while (nextToken)
  await Promise.all(deletion$);
  if (errors.length) {
    const errorsSummary: Error & { details?: unknown } = new Error('Error happen emptying bucket');
    errorsSummary.details = errors;
    throw errorsSummary;
  }
};
