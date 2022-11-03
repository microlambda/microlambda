import { promises as fs } from 'fs';
import { F_OK } from 'constants';

export const exists = async (path: string): Promise<boolean> => {
  try {
    await fs.access(path, F_OK);
    return true;
  } catch (e) {
    if ((e as { code: string }).code === 'ENOENT') {
      return false;
    }
    throw e;
  }
};
