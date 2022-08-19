import {ILayerChecksums} from "./layer-checksums";
import {PutObjectCommand, S3Client} from "@aws-sdk/client-s3";
import {maxAttempts} from "../max-attempts";
import { IBaseLogger } from "@microlambda/types";

export const writeLayerChecksums = async (bucket: string, key: string, checksums: ILayerChecksums, region: string, logger?: IBaseLogger): Promise<void> => {
    try {
        const client = new S3Client({ region, maxAttempts: maxAttempts() });
        await client.send(new PutObjectCommand({
            Bucket: bucket,
            Body: JSON.stringify(checksums),
            Key: key,

        }));
    } catch (e) {
        logger?.warn('Cannot write checksums to parameter store', e);
    }
};
