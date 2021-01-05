export declare enum MilaErrorCode {
    NOT_IN_A_VALID_LERNA_PROJECT = "NOT_IN_A_VALID_LERNA_PROJECT"
}
export declare class MilaError extends Error {
    private readonly _code;
    get code(): MilaErrorCode;
    constructor(code: MilaErrorCode);
}
