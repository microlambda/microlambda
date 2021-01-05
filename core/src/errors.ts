export enum MilaErrorCode {
  NOT_IN_A_VALID_LERNA_PROJECT = 'NOT_IN_A_VALID_LERNA_PROJECT',
}

const messages: Map<MilaErrorCode, string> = new Map([
  [
    MilaErrorCode.NOT_IN_A_VALID_LERNA_PROJECT,
    'It seems you are not running this command in a valid microlambda project.\nPlease check your current directory and try again.',
  ],
]);

export class MilaError extends Error {
  private readonly _code: MilaErrorCode;
  get code(): MilaErrorCode {
    return this._code;
  }
  constructor(code: MilaErrorCode) {
    super(messages.get(code));
    this._code = code;
  }
}
