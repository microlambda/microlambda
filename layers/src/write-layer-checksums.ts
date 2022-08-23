import {ILayerChecksums} from "./layer-checksums";
import { aws } from "@microlambda/aws";
import { IBaseLogger } from "@microlambda/types";

export const writeLayerChecksums = async (bucket: string, key: string, checksums: ILayerChecksums, region: string, logger?: IBaseLogger): Promise<void> => {
    try {
        await aws.s3.putObject(bucket, key, JSON.stringify(checksums), region);
    } catch (e) {
        logger?.warn('Cannot write checksums to parameter store', e);
    }
};
