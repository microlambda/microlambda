"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MilaError = exports.MilaErrorCode = void 0;
var MilaErrorCode;
(function (MilaErrorCode) {
    MilaErrorCode["NOT_IN_A_VALID_LERNA_PROJECT"] = "NOT_IN_A_VALID_LERNA_PROJECT";
})(MilaErrorCode = exports.MilaErrorCode || (exports.MilaErrorCode = {}));
const messages = new Map([
    [
        MilaErrorCode.NOT_IN_A_VALID_LERNA_PROJECT,
        'It seems you are not running this command in a valid microlambda project.\nPlease check your current directory and try again.',
    ],
]);
class MilaError extends Error {
    constructor(code) {
        super(messages.get(code));
        this._code = code;
    }
    get code() {
        return this._code;
    }
}
exports.MilaError = MilaError;
//# sourceMappingURL=errors.js.map