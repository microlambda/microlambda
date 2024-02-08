import { execSync } from 'child_process';

export const npm = {
  packageExists: (name: string): boolean => {
    try {
      execSync(`npm view ${name} --json`, { stdio: 'pipe' });
      return true;
    } catch (e) {
      if ((e as Error).message.includes('E404')) {
        return false;
      }
      throw e;
    }
  },
};
