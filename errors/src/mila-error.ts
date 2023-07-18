import { MilaErrorCode } from './mila-error-code';

export class MilaError extends Error {
  constructor(readonly code: MilaErrorCode, message: string, readonly originalError?: unknown) {
    super(message);
  }
}
