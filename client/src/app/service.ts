import { Package } from './package';
import { ServiceStatus } from './service.status.enum';
import { INode } from './node.interface';

export class Service extends Package {
  private _status: ServiceStatus;
  private readonly _port: number;
  constructor(node: INode) {
    super(node);
    this._status = node.status;
    this._port = node.port;
  }

  get port(): number { return this._port };

  get status(): string {
    switch (this._status) {
      case ServiceStatus.CRASHED:
        return 'Crashed';
      case ServiceStatus.RUNNING:
        return 'Running';
      case ServiceStatus.STARTING:
        return 'Starting';
      case ServiceStatus.STOPPED:
        return 'Stopped';
      case ServiceStatus.STOPPING:
        return 'Stopping';
    }
  }

  get statusClass(): string {
    switch (this._status) {
      case ServiceStatus.CRASHED:
        return 'bright-red';
      case ServiceStatus.RUNNING:
        return 'green';
      case ServiceStatus.STARTING:
        return 'blue';
      case ServiceStatus.STOPPED:
        return 'red';
      case ServiceStatus.STOPPING:
        return 'blue';
    }
  }

  get isRunning(): boolean {
    return this._status === ServiceStatus.RUNNING;
  }

  get canBeStarted(): boolean {
    return this._status === ServiceStatus.STOPPED || this._status === ServiceStatus.CRASHED;
  }

  setStatus(status: ServiceStatus): void {
    this._status = status;
  }
}
