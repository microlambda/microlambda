import {ILayerChecksums} from "./layer-checksums";
import {ILogger} from "../../types";
import {GetObjectCommand, S3Client} from "@aws-sdk/client-s3";
import {maxAttempts} from "../../utils/max-attempts";
import { Readable } from 'stream';

export const readLayerChecksums = async (bucket: string, key: string, region: string, logger?: ILogger): Promise<ILayerChecksums | null> => {
    try {
        const client = new S3Client({ region, maxAttempts: maxAttempts() });
        const handleDownloadStream = (stream: Readable): Promise<string> =>
            new Promise((resolve, reject) => {
                const chunks: Uint8Array[] = [];
                stream.on('data', (chunk: Uint8Array) => chunks.push(chunk));
                stream.on('error', reject);
                stream.on('end', () => resolve(Buffer.concat(chunks).toString("utf8")));
            });
        const { Body } =  await client.send(new GetObjectCommand({
            Bucket: bucket,
            Key: key,
        }));
        if (Body) {
            const raw = await handleDownloadStream(Body as Readable);
            return JSON.parse(raw) as ILayerChecksums;
        }
        return null;
    } catch (e) {
        logger?.warn('Cannot read checksums from parameter store', e);
        return null;
    }
};
