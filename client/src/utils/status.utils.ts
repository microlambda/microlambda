import type {
  ServiceStatus,
  TranspilingStatus,
  TypeCheckStatus,
} from '@microlambda/types';

export const getTranspiled = (status: TranspilingStatus): string => {
  switch (status) {
    case 'transpiled':
      return 'Transpiled';
    case 'transpiling':
      return 'Transpiling';
    case 'error_transpiling':
      return 'Error transpiling';
    case 'not_transpiled':
      return 'Not transpiled';
    default:
      return 'Unknown';
  }
};

export const getTypeChecked = (status: TypeCheckStatus): string => {
  switch (status) {
    case 'checking':
      return 'Typechecking';
    case 'not_checked':
      return 'Not type-checked';
    case 'error_checking_types':
      return 'Type errors';
    case 'type_checked':
      return 'Type checked';
    default:
      return 'Unknown';
  }
};

export const getTranspiledClass = (status: TranspilingStatus): string => {
  switch (status) {
    case 'transpiled':
      return 'green';
    case 'transpiling':
      return 'blue';
    case 'error_transpiling':
      return 'bright-red';
    case 'not_transpiled':
      return 'grey';
    default:
      return 'Unknown';
  }
};

export const getTypeCheckClass = (status: TypeCheckStatus): string => {
  switch (status) {
    case 'checking':
      return 'blue';
    case 'not_checked':
      return 'grey';
    case 'error_checking_types':
      return 'bright-red';
    case 'type_checked':
      return 'green';
    default:
      return 'Unknown';
  }
};

export const getServiceStatus = (
  status: ServiceStatus,
  enabled: boolean,
): string => {
  if (!enabled) {
    return 'Disabled';
  }
  switch (status) {
    case 'crashed':
      return 'Crashed';
    case 'running':
      return 'Running';
    case 'starting':
      return 'Starting';
    case 'stopped':
      return 'Stopped';
    case 'stopping':
      return 'Stopping';
    default:
      return 'Not started';
  }
};

export const getServiceStatusClass = (
  status: ServiceStatus,
  enabled: boolean,
): string => {
  if (!enabled) {
    return 'disabled';
  }
  switch (status) {
    case 'crashed':
      return 'bright-red';
    case 'running':
      return 'green';
    case 'starting':
      return 'blue';
    case 'stopped':
      return 'grey';
    case 'stopping':
      return 'orange';
    default:
      return 'grey';
  }
};
