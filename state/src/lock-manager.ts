import { State } from './models/state';
import { IRootConfig } from '@microlambda/config';

const TEN_MINUTES = 10 * 60 * 1000;
const TWENTY_SECONDS = 20  * 1000;

export class LockManager {
  state: State;
  constructor(config: IRootConfig) {
    this.state = new State(config);
  }

  async isLocked(env: string): Promise<boolean> {
    return this.state.exists(env, 'lock');
  }

  async waitLockToBeReleased(env: string, timeout = TEN_MINUTES): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      setTimeout(() => reject(new Error(`Lock was not release within ${timeout}ms`)), timeout);
      setInterval(() => {
        this.isLocked(env).then((locked) => {
          if (!locked) {
            resolve();
          }
        }).catch(() => {
          // retry next time
        });
      }, TWENTY_SECONDS);
    })
  }

  async lock(env: string): Promise<void> {
    await this.state.save({
      k1: env,
      k2: 'lock',
    });
  }

  async releaseLock(env: string): Promise<void> {
    await this.state.delete(env, 'lock');
  }
}
