import { State } from './models/state';
import { IRootConfig } from '@microlambda/config';
import { beginsWith } from 'dynamodels';

const TEN_MINUTES = 10 * 60 * 1000;
const TWENTY_SECONDS = 20 * 1000;

interface ILock {
  k1: string; // $env
  k2: string; // lock|$service
  env: string;
  service: string;
}

export class LockManager {
  state: State;
  constructor(config: IRootConfig, readonly env: string, private readonly _workspaces?: string[]) {
    this.state = new State(config.state.table, config.defaultRegion);
  }

  get workspaces(): string[] | undefined {
    return this._workspaces;
  }

  async getLocks(): Promise<Array<ILock>> {
    const locks = await this.state
      .query()
      .keys({
        k1: this.env,
        k2: beginsWith('lock|'),
      })
      .execAll();
    return locks as ILock[];
  }

  async isLocked(): Promise<boolean> {
    const locks = await this.getLocks();
    const workspaces = this.workspaces;
    if (!workspaces) {
      return locks.length > 0;
    }
    return locks.some((l) => workspaces.includes(l.service));
  }

  async waitLockToBeReleased(timeout = TEN_MINUTES): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      setTimeout(() => reject(new Error(`Lock was not release within ${timeout}ms`)), timeout);
      setInterval(() => {
        this.isLocked()
          .then((locked) => {
            if (!locked) {
              resolve();
            }
          })
          .catch(() => {
            // retry next time
          });
      }, TWENTY_SECONDS);
    });
  }

  async lock(): Promise<void> {
    const workspaces = this.workspaces;
    if (!workspaces) {
      throw Error('Cannot lock without target workspaces');
    }
    await Promise.all(
      workspaces.map((w) =>
        this.state.save({
          k1: this.env,
          k2: `lock|${w}`,
          env: this.env,
          service: w,
        }),
      ),
    );
  }

  async releaseLock(): Promise<void> {
    const workspaces = this.workspaces;
    if (!workspaces) {
      const allLocks = await this.getLocks();
      await Promise.all(
        allLocks.map((l) =>
          this.state.delete(l.k1, l.k2).catch((e) => {
            if (!e.message.includes('does not exists')) {
              throw e;
            }
          }),
        ),
      );
    } else {
      await Promise.all(
        workspaces.map((w) =>
          this.state.delete(this.env, `lock|${w}`).catch((e) => {
            if (!e.message.includes('does not exists')) {
              throw e;
            }
          }),
        ),
      );
    }
  }
}
