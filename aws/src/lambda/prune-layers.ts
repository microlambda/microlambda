import { LambdaClient, ListLayerVersionsCommand, DeleteLayerVersionCommand } from "@aws-sdk/client-lambda";
import { maxAttempts } from "../max-attempts";
import { IBaseLogger } from '@microlambda/types';

export const pruneLayers = async (keep: number, stackName: string, region: string, logger?: IBaseLogger): Promise<void> => {
    try {
        logger?.info('[layers] Pruning layers versions to keep only', keep, 'latest');
        const client = new LambdaClient({ region, maxAttempts: maxAttempts() });
        const versions = await client.send(new ListLayerVersionsCommand({
            LayerName: stackName,
        }));
        if (versions.LayerVersions && versions.LayerVersions.length > keep) {
            const versionNumbers = versions.LayerVersions.map(((l) => l.Version || -1));
            const desc = (n1: number, n2: number): number => n2 - n1;
            const toDelete = versionNumbers.filter((v) => v > 0).sort(desc).slice(keep);
            versions.LayerVersions.filter((v) => toDelete.includes(v.Version || -1)).forEach((layer) => {
                logger?.info('[layers] Pruning layer', layer.LayerVersionArn);
            });
            await Promise.all(toDelete.map(async (v) => {
                await client.send(new DeleteLayerVersionCommand({
                    LayerName: stackName,
                    VersionNumber: v,
                }));
            }));
        }
    } catch (e) {
        logger?.error('Error pruning layers');
        logger?.error(e);
    }
}
