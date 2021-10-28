import {IPackagrConfig, LambdaRuntimes} from "../../config/types/packagr";
import {ServerlessInstance} from "../../types";

export const resolveRunTime = (serverless: ServerlessInstance, config?: IPackagrConfig): LambdaRuntimes[] => {
    if (config?.runtimes) {
        return config.runtimes;
    }
    const providerRuntime = serverless.service.provider.runtime;
    const lambdaRuntimes = Object.values(serverless.service.functions).map((f) => f.runtime).filter((arch) => !!arch);
    if (lambdaRuntimes.length && lambdaRuntimes.some((run) => providerRuntime !== run)) {
        throw new Error('Unsupported function-level runtime configuration');
    }
    if (providerRuntime) {
        return [providerRuntime];
    }
    return ['nodejs14.x'];
};
