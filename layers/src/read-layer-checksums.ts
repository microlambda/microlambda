import {ILayerChecksums} from "./layer-checksums";
import { aws } from "@microlambda/aws";
import { IBaseLogger } from '@microlambda/types';

export const readLayerChecksums = async (bucket: string, key: string, region: string, logger?: IBaseLogger): Promise<ILayerChecksums | null> => {
    try {
        const raw = await aws.s3.downloadStream(bucket, key, region);
        if (raw) {
            return JSON.parse(raw.toString('utf-8')) as ILayerChecksums;
        }
        return null;
    } catch (e) {
        logger?.warn('Cannot read checksums from parameter store', e);
        return null;
    }
};
