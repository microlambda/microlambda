import { config } from 'dotenv';
import { join } from 'path';
import { existsSync } from 'fs';

export const loadEnv = (projectRoot: string): void => {
  const path = join(projectRoot, '.env');
  if (existsSync(path)) {
    const load = config({
      path,
    });
    if (load.error) {
      throw new Error('Unable to read .env file');
    }
  }
};
