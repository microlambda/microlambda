import {
  CompilerOptions,
  findConfigFile,
  ParseConfigHost,
  ParsedCommandLine,
  parseJsonConfigFileContent,
  readConfigFile,
  sys,
  transpileModule,
} from 'typescript';
import { access, constants, mkdir, readFile, writeFile } from 'fs';
import { join, relative, dirname } from 'path';
import { EventsLog } from '@microlambda/logger';

export const getTsConfig = (cwd: string): ParsedCommandLine => {
  const parseConfigHost: ParseConfigHost = {
    fileExists: sys.fileExists,
    readFile: sys.readFile,
    readDirectory: sys.readDirectory,
    useCaseSensitiveFileNames: true,
  };
  const configFileName = findConfigFile(cwd, sys.fileExists, 'tsconfig.json');
  if (!configFileName) {
    throw new Error('Cannot resolve tsconfig.json');
  }
  const configFile = readConfigFile(configFileName, sys.readFile);
  return parseJsonConfigFileContent(configFile.config, parseConfigHost, cwd);
};

const copyFile = async (dest: string, data: string, logger?: EventsLog): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    const folder = dirname(dest);
    access(dest, constants.F_OK, (err) => {
      if (err && err.code === 'ENOENT') {
        mkdir(folder, { recursive: true }, (err) => {
          if (err) {
            logger?.scope('ts').error('Error making target folder', folder);
            logger?.scope('ts').error(err);
            return reject(err);
          }
          writeFile(dest, data, (err) => {
            if (err) {
              logger?.scope('ts').error('Error write target file', dest);
              logger?.scope('ts').error(err);
              return reject(err);
            }
            return resolve();
          });
        });
      } else if (err) {
        logger?.scope('ts').error('Error checking existence of target folder', folder);
        logger?.scope('ts').error(err);
        return reject(err);
      } else {
        // Target folder exists
        writeFile(dest, data, (err) => {
          if (err) {
            logger?.scope('ts').error('Error write target file', dest);
            logger?.scope('ts').error(err);
            return reject(err);
          }
          return resolve();
        });
      }
    });
  });
};

export const compileFile = (
  cwd: string,
  absolutePath: string,
  compilerOptions: CompilerOptions,
  logger?: EventsLog,
): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    readFile(absolutePath, (err, buffer) => {
      if (err) {
        logger?.scope('ts').error(err);
        return reject(err);
      }
      const outDir = compilerOptions.outDir || join(cwd, 'lib');
      const js = transpileModule(buffer.toString(), { compilerOptions });
      const dest = join(outDir, relative(cwd, absolutePath.replace(/\.ts$/, '.js')));
      copyFile(dest, js.outputText, logger).then(resolve).catch(reject);
    });
  });
};

export const transpileFiles = async (cwd: string, logger?: EventsLog): Promise<void> => {
  logger?.scope('ts').debug('compiling files in directory', cwd);
  const config = getTsConfig(cwd);
  logger?.scope('ts').debug('config read', config);
  const fileNames = config.fileNames;
  await Promise.all(fileNames.map((file) => compileFile(cwd, file, config.options, logger)));
};
