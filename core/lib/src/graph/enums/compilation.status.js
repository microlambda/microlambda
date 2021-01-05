"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TypeCheckStatus = exports.TranspilingStatus = void 0;
var TranspilingStatus;
(function (TranspilingStatus) {
    TranspilingStatus[TranspilingStatus["NOT_TRANSPILED"] = 0] = "NOT_TRANSPILED";
    TranspilingStatus[TranspilingStatus["TRANSPILING"] = 1] = "TRANSPILING";
    TranspilingStatus[TranspilingStatus["TRANSPILED"] = 2] = "TRANSPILED";
    TranspilingStatus[TranspilingStatus["ERROR_TRANSPILING"] = 3] = "ERROR_TRANSPILING";
})(TranspilingStatus = exports.TranspilingStatus || (exports.TranspilingStatus = {}));
var TypeCheckStatus;
(function (TypeCheckStatus) {
    TypeCheckStatus[TypeCheckStatus["NOT_CHECKED"] = 0] = "NOT_CHECKED";
    TypeCheckStatus[TypeCheckStatus["CHECKING"] = 1] = "CHECKING";
    TypeCheckStatus[TypeCheckStatus["SUCCESS"] = 2] = "SUCCESS";
    TypeCheckStatus[TypeCheckStatus["ERROR"] = 3] = "ERROR";
})(TypeCheckStatus = exports.TypeCheckStatus || (exports.TypeCheckStatus = {}));
//# sourceMappingURL=compilation.status.js.map