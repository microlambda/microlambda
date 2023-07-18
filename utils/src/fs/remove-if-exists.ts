import { promises as fs } from 'fs';
import { exists } from './file-exists';

export const removeIfExists = async (path: string): Promise<void> => {
  if (await exists(path)) {
    await fs.unlink(path);
  }
};
