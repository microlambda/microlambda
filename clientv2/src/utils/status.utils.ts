import { TranspilingStatus, TypeCheckStatus, ServiceStatus } from '@microlambda/types';

export const getTranspiled = (status: TranspilingStatus): string => {
  switch (status) {
    case TranspilingStatus.TRANSPILED:
      return 'Transpiled';
    case TranspilingStatus.TRANSPILING:
      return 'Transpiling';
    case TranspilingStatus.ERROR_TRANSPILING:
      return 'Error transpiling';
    case TranspilingStatus.NOT_TRANSPILED:
      return 'Not transpiled';
    default:
      return 'Unknown';
  }
}

export const getTypeChecked = (status: TypeCheckStatus): string => {
  switch (status) {
    case TypeCheckStatus.CHECKING:
      return 'Typechecking';
    case TypeCheckStatus.NOT_CHECKED:
      return 'Not type-checked';
    case TypeCheckStatus.ERROR:
      return 'Type errors';
    case TypeCheckStatus.SUCCESS:
      return 'Type checked';
    default:
      return 'Unknown';
  }
}

export const getTranspiledClass = (status: TranspilingStatus): string => {
  switch (status) {
    case TranspilingStatus.TRANSPILED:
      return 'green';
    case TranspilingStatus.TRANSPILING:
      return 'blue';
    case TranspilingStatus.ERROR_TRANSPILING:
      return 'bright-red';
    case TranspilingStatus.NOT_TRANSPILED:
      return 'grey';
    default:
      return '';
  }
}

export const getTypeCheckClass = (status: TypeCheckStatus): string => {
  switch (status) {
    case TypeCheckStatus.CHECKING:
      return 'blue';
    case TypeCheckStatus.NOT_CHECKED:
      return 'grey';
    case TypeCheckStatus.ERROR:
      return 'bright-red';
    case TypeCheckStatus.SUCCESS:
      return 'green';
    default:
      return '';
  }
}

export const getServiceStatus = (status: ServiceStatus, enabled: boolean): string => {
  if (!enabled) {
    return 'Disabled';
  }
  switch (status) {
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
    default:
      return 'Unknown';
  }
}

export const getServiceStatusClass = (status: ServiceStatus, enabled: boolean): string => {
  if (!enabled) {
    return 'grey';
  }
  switch (status) {
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
    default:
      return '';
  }
}
