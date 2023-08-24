/**
 * For performance reasons transpiling (only emit js from ts) is performed in a separate thread than
 * type checking (ensure correct types are used and there will be no type errors at run time)
 */

export enum TranspilingStatus {
  NOT_TRANSPILED = 'not_transpiled',
  TRANSPILING = 'transpiling',
  TRANSPILED = 'transpiled',
  ERROR_TRANSPILING = 'error_transpiling',
}

export enum TypeCheckStatus {
  NOT_CHECKED= 'not_checked',
  CHECKING = 'checking',
  SUCCESS = 'type_checked',
  ERROR = 'error_checking_types',
}
