import { promises as fs, existsSync } from 'fs';
import {
  findConfigFile,
  ModuleKind,
  ParseConfigHost,
  ParsedCommandLine,
  parseJsonConfigFileContent,
  readConfigFile,
  sys,
  transpileModule,
} from 'typescript';
import { exists } from './fs-exists';
import { join, dirname } from 'path';

export const getTsConfig = (cwd: string, name = 'tsconfig.json'): ParsedCommandLine => {
  const parseConfigHost: ParseConfigHost = {
    fileExists: sys.fileExists,
    readFile: sys.readFile,
    readDirectory: sys.readDirectory,
    useCaseSensitiveFileNames: true,
  };
  const configFileName = findConfigFile(cwd, sys.fileExists, name);
  if (!configFileName) {
    return { options: {} } as ParsedCommandLine;
  }
  const configFile = readConfigFile(configFileName, sys.readFile);
  return parseJsonConfigFileContent(configFile.config, parseConfigHost, cwd);
};

export const transpileTs = async (path: string, config?: ParsedCommandLine, recompile = true): Promise<string> => {
  const buffer = await fs.readFile(path);
  const tsConfig = config ?? getTsConfig(path);
  const js = transpileModule(buffer.toString(), { compilerOptions: tsConfig.options ?? {} });
  const extension = tsConfig.options.module === ModuleKind.CommonJS ? '.js' : '.mjs';
  const jsPath = path.replace(/\.ts$/, extension);
  const isCompiled = await exists(jsPath);
  if (isCompiled && !recompile) {
    return jsPath;
  } else if (isCompiled) {
    await fs.unlink(jsPath);
  }
  const importRegex = /import(.+)from +(["'])(.+)(["'])/g;
  const importsStatements = buffer.toString().matchAll(importRegex);
  for (const importsStatement of importsStatements) {
    const importFrom = importsStatement[3];
    if (importFrom.startsWith('.')) {
      const importFromPath = join(dirname(path), ...importFrom.split('/')) + '.ts';
      if (existsSync(importFromPath)) {
        await transpileTs(importFromPath, tsConfig);
      }
    }
  }
  await fs.writeFile(jsPath, js.outputText);
  return jsPath;
};
