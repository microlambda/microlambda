import { join } from 'path';
import { existsSync } from 'fs';
import { execSync, spawn } from 'child_process';
import { log } from './logger';
import { LernaNode } from '../lerna';
import { CompilationMode } from '../config/config';

type Cmd = 'tsc' | 'babel' | 'sls' | 'lerna';

const logger = log('binaries');

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
export const getBinary = (cmd: Cmd, projectRoot: string, node?: LernaNode): string => {
  const cmdPath = ['node_modules', '.bin', cmd];
  const projectBinary = join(projectRoot, ...cmdPath);
  if (!node) {
    return projectBinary;
  }
  const localBinary = join(node.getLocation(), ...cmdPath);
  const hasLocal = existsSync(localBinary);
  const binary = hasLocal ? localBinary : projectBinary;
  logger.debug(`Using ${hasLocal ? 'local' : 'project'} ${cmd}`, getVersion(binary));
  logger.debug('Path to binary', hasLocal ? localBinary : projectBinary);
  return binary;
};

const testBinary = (cmd: Cmd, projectRoot: string): boolean => {
  return existsSync(getBinary(cmd, projectRoot));
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
export const verifyBinaries = async (mode: CompilationMode, projectRoot: string): Promise<void> => {
  const binaryPackages: Map<Cmd, string[]> = new Map();
  binaryPackages.set('lerna', ['lerna']);
  binaryPackages.set('tsc', ['typescript']);
  binaryPackages.set('sls', ['serverless']);
  binaryPackages.set('babel', ['@babel/cli', '@babel/core', '@babel/preset-typescript']);
  const binariesToTest: Cmd[] = ['tsc', 'sls'];
  if (mode === 'lazy') {
    binariesToTest.push('babel');
  }
  const deps: string[] = [];
  for (const cmd of binariesToTest) {
    if (!testBinary(cmd, projectRoot)) {
      const packagesToInstall = binaryPackages.get(cmd);
      packagesToInstall.forEach((pkg) => {
        logger.warn(`Missing peer dependency ${pkg}`);
        deps.push(pkg);
      });
    }
  }
  if (deps.length > 0) {
    logger.info('Installing missing peer dependencies');
    await installBinary(deps, projectRoot);
  }
};
