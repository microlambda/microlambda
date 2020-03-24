import { spawn, SpawnOptions } from 'child_process';
import { log } from './logger';

type Verbosity = 'silly' | 'debug' | 'info' | 'warn' | 'error';

export const execCmd = async (
  cmd: string,
  args: ReadonlyArray<string> = null,
  options: SpawnOptions = null,
  stdout: Verbosity = 'debug',
  stderr: Verbosity = 'error',
): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    let _stdout = '';
    const process = spawn(cmd, args, options);
    process.stdout.on('data', (data) => {
      log('child_process')[stdout](data.toString());
      _stdout += data.toString();
    });
    process.stderr.on('data', (data) => log('child_process')[stderr](data.toString()));
    process.on('close', (code) => {
      if (code === 0) {
        return resolve(_stdout);
      }
      return reject('Process exited with code ' + code);
    });
    process.on('error', (e) => {
      log('child_process').error(e);
      return reject(e);
    });
  });
};
