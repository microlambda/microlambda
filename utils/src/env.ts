import { config } from "dotenv";
import { join } from 'path';

export const loadEnv = (projectRoot: string): void => {
  const load = config({
    path: join(projectRoot, '.env'),
  });
  if (load.error) {
    throw new Error('Unable to read .env file');
  }
};
