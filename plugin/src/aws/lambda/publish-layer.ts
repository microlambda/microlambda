import {LambdaClient, PublishLayerVersionCommand} from "@aws-sdk/client-lambda";
import {maxAttempts} from "../../utils/max-attempts";
import {resolveArchitecture} from "./resolve-architecture";
import {resolveRunTime} from "./resolve-runtime";
import {IPackagrConfig} from "../../config/types/packagr";
import {ILogger, ServerlessInstance} from "../../types";
import { promises as fs } from 'fs';

export const publishLayer = async (zipLocation: string, stackName: string, serverless: ServerlessInstance, config?: IPackagrConfig, logger?: ILogger): Promise<string | undefined> => {
    const client = new LambdaClient({ region: serverless.providers.aws.getRegion(), maxAttempts: maxAttempts() });
    const buffer = await fs.readFile(zipLocation);
    const options = {
        LayerName: stackName,
        CompatibleArchitectures: [resolveArchitecture(serverless, config)],
        CompatibleRuntimes: resolveRunTime(serverless, config),
        Description: `Lambda layer for service ${stackName}`,
    }
    logger?.info('[layers] Publishing layer', options)
    const result = await client.send(new PublishLayerVersionCommand({
        Content: { ZipFile: buffer },
        ...options,
    }));
    logger?.info('[layer] Layer published');
    return result.LayerVersionArn;
};
