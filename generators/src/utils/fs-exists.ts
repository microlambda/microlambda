import { promises as fs } from 'fs';

export const exists = async (path: string): Promise<boolean> => {
  try {
    await fs.stat(path);
    return true;
  } catch (e) {
    if (e.code === 'ENOENT') {
      return false;
    }
    throw e;
  }
};
