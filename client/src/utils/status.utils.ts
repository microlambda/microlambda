import type {
  TranspilingStatus,
  TypeCheckStatus,
  ServiceStatus,
} from "@microlambda/types";

export const getTranspiled = (status: TranspilingStatus): string => {
  switch (status) {
    case 2:
      return "Transpiled";
    case 1:
      return "Transpiling";
    case 3:
      return "Error transpiling";
    case 0:
      return "Not transpiled";
    default:
      return "Unknown";
  }
};

export const getTypeChecked = (status: TypeCheckStatus): string => {
  switch (status) {
    case 1:
      return "Typechecking";
    case 0:
      return "Not type-checked";
    case 3:
      return "Type errors";
    case 2:
      return "Type checked";
    default:
      return "Unknown";
  }
};

export const getTranspiledClass = (status: TranspilingStatus): string => {
  switch (status) {
    case 2:
      return "green";
    case 1:
      return "blue";
    case 3:
      return "bright-red";
    case 0:
      return "grey";
    default:
      return "";
  }
};

export const getTypeCheckClass = (status: TypeCheckStatus): string => {
  switch (status) {
    case 1:
      return "blue";
    case 0:
      return "grey";
    case 3:
      return "bright-red";
    case 2:
      return "green";
    default:
      return "";
  }
};

export const getServiceStatus = (
  status: ServiceStatus,
  enabled: boolean
): string => {
  if (!enabled) {
    return "Disabled";
  }
  switch (status) {
    case 4:
      return "Crashed";
    case 1:
      return "Running";
    case 0:
      return "Starting";
    case 3:
      return "Stopped";
    case 2:
      return "Stopping";
    default:
      return "Unknown";
  }
};

export const getServiceStatusClass = (
  status: ServiceStatus,
  enabled: boolean
): string => {
  if (!enabled) {
    return "grey";
  }
  switch (status) {
    case 4:
      return "bright-red";
    case 1:
      return "green";
    case 0:
      return "blue";
    case 3:
      return "red";
    case 2:
      return "blue";
    default:
      return "";
  }
};
