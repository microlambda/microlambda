import { promises as fs } from 'fs';
import { transpileModule } from 'typescript';
import { exists } from './fs-exists';
import {
  findConfigFile,
  ParseConfigHost,
  ParsedCommandLine,
  parseJsonConfigFileContent,
  readConfigFile,
  sys,
} from 'typescript';

export const getTsConfig = (cwd: string, name = 'tsconfig.json'): ParsedCommandLine => {
  const parseConfigHost: ParseConfigHost = {
    fileExists: sys.fileExists,
    readFile: sys.readFile,
    readDirectory: sys.readDirectory,
    useCaseSensitiveFileNames: true,
  };
  const configFileName = findConfigFile(cwd, sys.fileExists, name);
  if (!configFileName) {
    throw new Error('Cannot resolve tsconfig.json');
  }
  const configFile = readConfigFile(configFileName, sys.readFile);
  return parseJsonConfigFileContent(configFile.config, parseConfigHost, cwd);
};

export const transpileTs = async (path: string, recompile = true): Promise<string> => {
  const buffer = await fs.readFile(path);
  const config = getTsConfig(path);
  const js = transpileModule(buffer.toString(), { compilerOptions: config.options ?? {} });
  const jsPath = path.replace(/\.ts$/, '.js');
  const isCompiled = await exists(jsPath);
  if (isCompiled && !recompile) {
    return jsPath;
  } else if (isCompiled) {
    await fs.unlink(jsPath);
  }
  await fs.writeFile(jsPath, js.outputText);
  return jsPath;
};
