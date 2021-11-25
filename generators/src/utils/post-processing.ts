import {join} from "path";
import {exists} from "./fs-exists";
import {transpileTs} from "./transpile";

export const postProcessing = async (path: string, inputs: Record<string, unknown>) => {
    const postProcessingPath = join(path, 'post-processing.ts');
    const hasPostProcessing = await exists(postProcessingPath);
    if (hasPostProcessing) {
        const jsPath = await transpileTs(postProcessingPath);
        const postProcessing = require(jsPath);
        await postProcessing.default(inputs);
    }
};
