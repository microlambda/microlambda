/**
 * For performance reasons transpiling (only emit js from ts) is performed in a separate thread than
 * type checking (ensure correct types are used and there will be no type errors at run time)
 */

export enum TranspilingStatus {
  NOT_TRANSPILED,
  TRANSPILING,
  TRANSPILED,
  ERROR_TRANSPILING,
}

export enum TypeCheckStatus {
  NOT_CHECKED,
  CHECKING,
  SUCCESS,
  ERROR,
}
