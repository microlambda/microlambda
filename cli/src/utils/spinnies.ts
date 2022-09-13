import Spinnies from 'spinnies';
import { logger } from './logger';

export class MilaSpinnies {
  readonly tty: boolean;
  private readonly _spinnies: Spinnies;
  constructor(readonly verbose = false) {
    this.tty = process.stdout.isTTY && !verbose;
    this._spinnies = new Spinnies({
      failColor: 'white',
      succeedColor: 'white',
      spinnerColor: 'cyan',
    });
  }

  get stdio(): 'inherit' | undefined {
    return this.tty ? undefined : 'inherit';
  }

  add(key: string, message: string) {
    if (this.tty) {
      this._spinnies.add(key, {text: message });
    } else {
      logger.info(message);
    }
  }

  succeed(key: string, message: string) {
    if (this.tty && this._spinnies.pick(key)) {
      this._spinnies.succeed(key, { text: message });
    } else if(!this.tty) {
      logger.info(message);
    }
  }

  fail(key: string, message: string) {
    if (this.tty && this._spinnies.pick(key)) {
      this._spinnies.fail(key, { text: message });
    } else if(!this.tty) {
      logger.info(message);
    }
  }

  update(key: string, message: string) {
    if (this.tty && this._spinnies.pick(key)) {
      this._spinnies.update(key, { text: message });
    } else if(!this.tty) {
      logger.info(message);
    }
  }

  stopAll() {
    this._spinnies.stopAll();
  }
}
