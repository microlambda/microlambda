import { join } from 'path';
import { existsSync } from 'fs';
import { execSync, spawn } from 'child_process';
import { Node } from '../graph';
import { CompilationMode } from '../config/config';
import { Logger } from './logger';


/*
FIXME: The idea here would be to use npm local scripts start, test, deploy instead
 */

type Cmd = 'tsc' | 'sls' | 'lerna';

const versions: Map<string, string> = new Map();

const getVersion = (binary: string): string => {
  if (versions.has(binary)) {
    return versions.get(binary);
  }
  const version = execSync(binary + ' --version')
    .toString()
    .match(/[0-9]+\.[0-9]+\.[0-9]+/)[0];
  versions.set(binary, version);
  return version;
};

/**
 * Check if a local version of binary id available.
 * Otherwise fallback on project binary which is a peerDependencies, and thus, should be
 * installed
 * @param cmd
 * @param projectRoot
 * @param node
 */
export const getBinary = (cmd: Cmd, projectRoot: string, logger: Logger, node?: Node): string => {
  const cmdPath = ['node_modules', '.bin', cmd];
  const projectBinary = join(projectRoot, ...cmdPath);
  if (!node) {
    return projectBinary;
  }
  const localBinary = join(node.getLocation(), ...cmdPath);
  const hasLocal = existsSync(localBinary);
  const binary = hasLocal ? localBinary : projectBinary;
  logger.log('binaries').debug(`Using ${hasLocal ? 'local' : 'project'} ${cmd}`, getVersion(binary));
  logger.log('binaries').debug('Path to binary', hasLocal ? localBinary : projectBinary);
  return binary;
};

const testBinary = (cmd: Cmd, projectRoot: string, logger: Logger): boolean => {
  return existsSync(getBinary(cmd, projectRoot, logger));
};

const installBinary = async (deps: string[], projectRoot: string): Promise<void> => {
  const process = spawn('npm', ['i', '-D', ...deps], {
    cwd: projectRoot,
    stdio: 'inherit',
  });
  return new Promise((resolve, reject) => {
    process.on('close', (code) => {
      if (code === 0) {
        return resolve();
      }
      return reject();
    });
    process.on('error', (err) => reject(err));
  });
};

/**
 * Check that peer dependencies binaries are installed.
 * If not install them.
 * @param mode
 * @param projectRoot
 */
export const verifyBinaries = async (mode: CompilationMode, projectRoot: string, logger: Logger): Promise<void> => {
  const binaryPackages: Map<Cmd, string[]> = new Map();
  binaryPackages.set('lerna', ['lerna']);
  binaryPackages.set('tsc', ['typescript']);
  binaryPackages.set('sls', ['serverless']);
  const binariesToTest: Cmd[] = ['tsc', 'sls'];
  const deps: string[] = [];
  for (const cmd of binariesToTest) {
    if (!testBinary(cmd, projectRoot, logger)) {
      const packagesToInstall = binaryPackages.get(cmd);
      packagesToInstall.forEach((pkg) => {
        logger.log('binaries').warn(`Missing peer dependency ${pkg}`);
        deps.push(pkg);
      });
    }
  }
  if (deps.length > 0) {
    logger.log('binaries').info('Installing missing peer dependencies');
    await installBinary(deps, projectRoot);
  }
};
