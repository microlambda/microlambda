"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceStatus = void 0;
var ServiceStatus;
(function (ServiceStatus) {
    ServiceStatus[ServiceStatus["STARTING"] = 0] = "STARTING";
    ServiceStatus[ServiceStatus["RUNNING"] = 1] = "RUNNING";
    ServiceStatus[ServiceStatus["STOPPING"] = 2] = "STOPPING";
    ServiceStatus[ServiceStatus["STOPPED"] = 3] = "STOPPED";
    ServiceStatus[ServiceStatus["CRASHED"] = 4] = "CRASHED";
})(ServiceStatus = exports.ServiceStatus || (exports.ServiceStatus = {}));
//# sourceMappingURL=service.status.js.map