import {promises as fs} from "fs";
import {transpileModule} from "typescript";
import { exists } from "./fs-exists";

export const transpileTs = async (
    path: string,
    recompile = true,
): Promise<string> => {
    const buffer = await fs.readFile(path);
    const js = transpileModule(buffer.toString(), {});
    const jsPath = path.replace(/\.ts$/, '.js');
    const isCompiled = await exists(jsPath);
    if (isCompiled && !recompile) {
        return jsPath;
    } else if(isCompiled) {
        await fs.unlink(jsPath);
    }
    await fs.writeFile(jsPath, js.outputText);
    return jsPath;
};
