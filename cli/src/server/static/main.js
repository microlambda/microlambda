(window["webpackJsonp"] = window["webpackJsonp"] || []).push([["main"],{

/***/ 0:
/*!***************************!*\
  !*** multi ./src/main.ts ***!
  \***************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(/*! /Users/marioarnautou/Code/OpenSource/µlambda/client/src/main.ts */"zUnb");


/***/ }),

/***/ 1:
/*!********************!*\
  !*** ws (ignored) ***!
  \********************/
/*! no static exports found */
/***/ (function(module, exports) {

/* (ignored) */

/***/ }),

/***/ "AytR":
/*!*****************************************!*\
  !*** ./src/environments/environment.ts ***!
  \*****************************************/
/*! exports provided: environment */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "environment", function() { return environment; });
// This file can be replaced during build by using the `fileReplacements` array.
// `ng build --prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.
const environment = {
    production: false,
    port: 4545,
};
/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/dist/zone-error';  // Included with Angular CLI.


/***/ }),

/***/ "BUAc":
/*!********************************************!*\
  !*** ./src/app/compilation.status.enum.ts ***!
  \********************************************/
/*! exports provided: CompilationStatus */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "CompilationStatus", function() { return CompilationStatus; });
// TODO: import from back
var CompilationStatus;
(function (CompilationStatus) {
    CompilationStatus[CompilationStatus["NOT_COMPILED"] = 0] = "NOT_COMPILED";
    CompilationStatus[CompilationStatus["COMPILING"] = 1] = "COMPILING";
    CompilationStatus[CompilationStatus["COMPILED"] = 2] = "COMPILED";
    CompilationStatus[CompilationStatus["ERROR_COMPILING"] = 3] = "ERROR_COMPILING";
})(CompilationStatus || (CompilationStatus = {}));


/***/ }),

/***/ "BYCq":
/*!****************************!*\
  !*** ./src/app/package.ts ***!
  \****************************/
/*! exports provided: Package */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "Package", function() { return Package; });
/* harmony import */ var _compilation_status_enum__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./compilation.status.enum */ "BUAc");

class Package {
    constructor(node) {
        this._name = node.name;
        this._version = node.version;
        this._enabled = node.enabled;
        this._compilationStatus = node.compiled;
    }
    get name() {
        return this._name;
    }
    get disabled() {
        return !this._enabled;
    }
    get version() {
        return this._version;
    }
    get compilationStatus() {
        switch (this._compilationStatus) {
            case _compilation_status_enum__WEBPACK_IMPORTED_MODULE_0__["CompilationStatus"].COMPILED:
                return 'Compiled';
            case _compilation_status_enum__WEBPACK_IMPORTED_MODULE_0__["CompilationStatus"].COMPILING:
                return 'Compiled';
            case _compilation_status_enum__WEBPACK_IMPORTED_MODULE_0__["CompilationStatus"].ERROR_COMPILING:
                return 'Error compiling';
            case _compilation_status_enum__WEBPACK_IMPORTED_MODULE_0__["CompilationStatus"].NOT_COMPILED:
                return 'Not compiled';
        }
    }
    get compilationClass() {
        switch (this._compilationStatus) {
            case _compilation_status_enum__WEBPACK_IMPORTED_MODULE_0__["CompilationStatus"].COMPILED:
                return 'green';
            case _compilation_status_enum__WEBPACK_IMPORTED_MODULE_0__["CompilationStatus"].COMPILING:
                return 'blue';
            case _compilation_status_enum__WEBPACK_IMPORTED_MODULE_0__["CompilationStatus"].ERROR_COMPILING:
                return 'bright-red';
            case _compilation_status_enum__WEBPACK_IMPORTED_MODULE_0__["CompilationStatus"].NOT_COMPILED:
                return 'grey';
        }
    }
    setCompilationStatus(status) {
        this._compilationStatus = status;
    }
}


/***/ }),

/***/ "Bhgz":
/*!*********************************!*\
  !*** ./src/app/mila.service.ts ***!
  \*********************************/
/*! exports provided: MilaService */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "MilaService", function() { return MilaService; });
/* harmony import */ var _angular_core__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @angular/core */ "fXoL");
/* harmony import */ var _environments_environment__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../environments/environment */ "AytR");
/* harmony import */ var rxjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! rxjs */ "qCKp");
/* harmony import */ var socket_io_client__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! socket.io-client */ "gFX4");
/* harmony import */ var socket_io_client__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(socket_io_client__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var _service__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./service */ "QcRX");
/* harmony import */ var _package__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./package */ "BYCq");
/* harmony import */ var _log__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./log */ "Clgq");
/* harmony import */ var _angular_common_http__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @angular/common/http */ "tk/3");









/**
 * TODO:
 * - Port
 * - Compilation Logs
 * - SLS logs
 * - Start / Stop / Restart / Change port
 * - Test
 * - Package tree
 * - Package / Deploy
 * - Default region / AWS credentials
 * - Binaries Versions
 * - Graph
 * - Resources consumption
 *
 */
const BASE_URL = _environments_environment__WEBPACK_IMPORTED_MODULE_1__["environment"].production ? window.origin : `http://localhost:${_environments_environment__WEBPACK_IMPORTED_MODULE_1__["environment"].port}`;
class MilaService {
    constructor(http) {
        this.http = http;
        this._connected$ = new rxjs__WEBPACK_IMPORTED_MODULE_2__["BehaviorSubject"](false);
        this._packages$ = new rxjs__WEBPACK_IMPORTED_MODULE_2__["BehaviorSubject"]([]);
        this._services$ = new rxjs__WEBPACK_IMPORTED_MODULE_2__["BehaviorSubject"]([]);
        this._logs$ = new rxjs__WEBPACK_IMPORTED_MODULE_2__["BehaviorSubject"]([]);
        // FIXME: Change url
        this._socket = socket_io_client__WEBPACK_IMPORTED_MODULE_3__('http://localhost:4545');
        this.packages$ = this._packages$.asObservable();
        this.services$ = this._services$.asObservable();
        this.log$ = this._logs$.asObservable();
        this.connected$ = this._connected$.asObservable();
        this._socket.on('connect', () => {
            console.debug('connected to mila server');
            this._connected$.next(true);
        });
        this._socket.on('disconnect', () => {
            console.debug('disconnected to mila server');
            this._connected$.next(false);
        });
        this._socket.on('compilation.status.updated', (data) => {
            console.debug('received compilation event', data);
            const isService = this._services$.getValue().some(s => s.name === data.node);
            const obs = isService ? this._services$ : this._packages$;
            const nodes = [...obs.getValue()];
            const toUpdate = nodes.find(s => s.name === data.node);
            if (!toUpdate) {
                throw Error('No node found');
            }
            toUpdate.setCompilationStatus(data.status);
            obs.next(nodes);
            console.debug('nodes updated', nodes);
        });
        this._socket.on('node.status.updated', (data) => {
            console.debug('received service event', data);
            const services = [...this._services$.getValue()];
            const toUpdate = services.find(s => s.name === data.node);
            if (!toUpdate) {
                throw Error('No node found');
            }
            toUpdate.setStatus(data.status);
            this._services$.next(services);
            console.debug('services updated', services);
        });
        this._socket.on('event.log.added', (log) => {
            console.debug('log received', log);
            const logs = this._logs$.getValue();
            logs.push(new _log__WEBPACK_IMPORTED_MODULE_6__["Log"](log));
            this._logs$.next(logs);
            console.debug('logs updated', logs);
        });
    }
    getGraph() {
        return this.http.get(`${BASE_URL}/api/graph`).subscribe((nodes) => {
            this._packages$.next(nodes.filter(n => n.status == null).map(n => new _package__WEBPACK_IMPORTED_MODULE_5__["Package"](n)));
            this._services$.next(nodes.filter(n => n.status != null).map(n => new _service__WEBPACK_IMPORTED_MODULE_4__["Service"](n)));
        });
    }
    getLogs() {
        return this.http.get(`${BASE_URL}/api/logs`).subscribe((logs) => {
            this._logs$.next(logs.map(l => new _log__WEBPACK_IMPORTED_MODULE_6__["Log"](l)));
        });
    }
}
MilaService.ɵfac = function MilaService_Factory(t) { return new (t || MilaService)(_angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵinject"](_angular_common_http__WEBPACK_IMPORTED_MODULE_7__["HttpClient"])); };
MilaService.ɵprov = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵdefineInjectable"]({ token: MilaService, factory: MilaService.ɵfac, providedIn: 'root' });
/*@__PURE__*/ (function () { _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵsetClassMetadata"](MilaService, [{
        type: _angular_core__WEBPACK_IMPORTED_MODULE_0__["Injectable"],
        args: [{
                providedIn: 'root'
            }]
    }], function () { return [{ type: _angular_common_http__WEBPACK_IMPORTED_MODULE_7__["HttpClient"] }]; }, null); })();


/***/ }),

/***/ "Clgq":
/*!************************!*\
  !*** ./src/app/log.ts ***!
  \************************/
/*! exports provided: Log */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "Log", function() { return Log; });
/* harmony import */ var ansi_to_html__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ansi-to-html */ "YavU");
/* harmony import */ var ansi_to_html__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(ansi_to_html__WEBPACK_IMPORTED_MODULE_0__);

const convert = new ansi_to_html__WEBPACK_IMPORTED_MODULE_0__();
class Log {
    constructor(log) {
        this._level = log.level;
        this._date = log.date;
        this._scope = log.scope;
        this._args = log.args;
    }
    get level() { return this._level; }
    get date() { return this._date; }
    get scope() { return this._scope; }
    get args() { return this._args.map(arg => convert.toHtml(arg)).join(' '); }
    get class() {
        switch (this._level) {
            case 'debug':
                return 'blue';
            case 'error':
                return 'red';
            case 'info':
                return 'green';
            case 'silly':
                return 'cyan';
            case 'warn':
                return 'orange';
        }
    }
}


/***/ }),

/***/ "GYW3":
/*!****************************************!*\
  !*** ./src/app/service.status.enum.ts ***!
  \****************************************/
/*! exports provided: ServiceStatus */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "ServiceStatus", function() { return ServiceStatus; });
var ServiceStatus;
(function (ServiceStatus) {
    ServiceStatus[ServiceStatus["STARTING"] = 0] = "STARTING";
    ServiceStatus[ServiceStatus["RUNNING"] = 1] = "RUNNING";
    ServiceStatus[ServiceStatus["STOPPING"] = 2] = "STOPPING";
    ServiceStatus[ServiceStatus["STOPPED"] = 3] = "STOPPED";
    ServiceStatus[ServiceStatus["CRASHED"] = 4] = "CRASHED";
})(ServiceStatus || (ServiceStatus = {}));


/***/ }),

/***/ "QcRX":
/*!****************************!*\
  !*** ./src/app/service.ts ***!
  \****************************/
/*! exports provided: Service */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "Service", function() { return Service; });
/* harmony import */ var _package__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./package */ "BYCq");
/* harmony import */ var _service_status_enum__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./service.status.enum */ "GYW3");


class Service extends _package__WEBPACK_IMPORTED_MODULE_0__["Package"] {
    constructor(node) {
        super(node);
        this._status = node.status;
        this._port = node.port;
    }
    get port() { return this._port; }
    ;
    get status() {
        switch (this._status) {
            case _service_status_enum__WEBPACK_IMPORTED_MODULE_1__["ServiceStatus"].CRASHED:
                return 'Crashed';
            case _service_status_enum__WEBPACK_IMPORTED_MODULE_1__["ServiceStatus"].RUNNING:
                return 'Running';
            case _service_status_enum__WEBPACK_IMPORTED_MODULE_1__["ServiceStatus"].STARTING:
                return 'Starting';
            case _service_status_enum__WEBPACK_IMPORTED_MODULE_1__["ServiceStatus"].STOPPED:
                return 'Stopped';
            case _service_status_enum__WEBPACK_IMPORTED_MODULE_1__["ServiceStatus"].STOPPING:
                return 'Stopping';
        }
    }
    get statusClass() {
        switch (this._status) {
            case _service_status_enum__WEBPACK_IMPORTED_MODULE_1__["ServiceStatus"].CRASHED:
                return 'bright-red';
            case _service_status_enum__WEBPACK_IMPORTED_MODULE_1__["ServiceStatus"].RUNNING:
                return 'green';
            case _service_status_enum__WEBPACK_IMPORTED_MODULE_1__["ServiceStatus"].STARTING:
                return 'blue';
            case _service_status_enum__WEBPACK_IMPORTED_MODULE_1__["ServiceStatus"].STOPPED:
                return 'red';
            case _service_status_enum__WEBPACK_IMPORTED_MODULE_1__["ServiceStatus"].STOPPING:
                return 'blue';
        }
    }
    setStatus(status) {
        this._status = status;
    }
}


/***/ }),

/***/ "Sy1n":
/*!**********************************!*\
  !*** ./src/app/app.component.ts ***!
  \**********************************/
/*! exports provided: AppComponent */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "AppComponent", function() { return AppComponent; });
/* harmony import */ var _angular_core__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @angular/core */ "fXoL");
/* harmony import */ var _mila_service__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./mila.service */ "Bhgz");
/* harmony import */ var _angular_common__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @angular/common */ "ofXK");
/* harmony import */ var _3dgenomes_ngx_resizable__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @3dgenomes/ngx-resizable */ "ZySY");
/* harmony import */ var _nodes_list_nodes_list_component__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./nodes-list/nodes-list.component */ "lPRk");
/* harmony import */ var _events_log_events_log_component__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./events-log/events-log.component */ "h9jK");







function AppComponent_p_5_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "p");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](1, "Waiting for mila server");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
} }
const _c0 = function () { return ["right"]; };
const _c1 = function () { return ["none"]; };
function AppComponent_rsz_layout_7_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "rsz-layout", 2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](1, "rsz-layout", 3);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelement"](2, "app-nodes-list");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](3, "rsz-layout", 4);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelement"](4, "app-events-log");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
} if (rf & 2) {
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("rFlex", true);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("directions", _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵpureFunction0"](5, _c0))("rFlex", true);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("directions", _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵpureFunction0"](6, _c1))("rFlex", false);
} }
class AppComponent {
    constructor(mila) {
        this.mila = mila;
        this.title = 'client';
    }
}
AppComponent.ɵfac = function AppComponent_Factory(t) { return new (t || AppComponent)(_angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵdirectiveInject"](_mila_service__WEBPACK_IMPORTED_MODULE_1__["MilaService"])); };
AppComponent.ɵcmp = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵdefineComponent"]({ type: AppComponent, selectors: [["app-root"]], decls: 9, vars: 6, consts: [[4, "ngIf"], ["class", "row main-content", 3, "rFlex", 4, "ngIf"], [1, "row", "main-content", 3, "rFlex"], [1, "cell", "services", 3, "directions", "rFlex"], [1, "cell", "logs", 3, "directions", "rFlex"]], template: function AppComponent_Template(rf, ctx) { if (rf & 1) {
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "html");
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](1, "body");
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](2, "header");
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](3, "h1");
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](4, "Micro\u03BBambda");
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](5, AppComponent_p_5_Template, 2, 0, "p", 0);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵpipe"](6, "async");
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](7, AppComponent_rsz_layout_7_Template, 5, 7, "rsz-layout", 1);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵpipe"](8, "async");
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    } if (rf & 2) {
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](5);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngIf", _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵpipeBind1"](6, 2, ctx.mila.connected$) === false);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](2);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngIf", _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵpipeBind1"](8, 4, ctx.mila.connected$) === true);
    } }, directives: [_angular_common__WEBPACK_IMPORTED_MODULE_2__["NgIf"], _3dgenomes_ngx_resizable__WEBPACK_IMPORTED_MODULE_3__["ResizableComponent"], _nodes_list_nodes_list_component__WEBPACK_IMPORTED_MODULE_4__["NodesListComponent"], _events_log_events_log_component__WEBPACK_IMPORTED_MODULE_5__["EventsLogComponent"]], pipes: [_angular_common__WEBPACK_IMPORTED_MODULE_2__["AsyncPipe"]], styles: ["header[_ngcontent-%COMP%] {\n  height: 64px;\n}\n\n.main-content[_ngcontent-%COMP%] {\n  height: calc(100vh - 85px);\n}\n\n.cell[_ngcontent-%COMP%] {\n  background-color: transparent;\n  border: none;\n  border-top: 4px solid #454545;\n  padding: 20px;\n}\n\n.cell.services[_ngcontent-%COMP%] {\n  border-right: 4px solid #454545;\n}\n/*# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImFwcC5jb21wb25lbnQuc2NzcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtFQUNFLFlBQUE7QUFDRjs7QUFFQTtFQUNFLDBCQUFBO0FBQ0Y7O0FBRUE7RUFDRSw2QkFBQTtFQUNBLFlBQUE7RUFDQSw2QkFBQTtFQUNBLGFBQUE7QUFDRjs7QUFBRTtFQUNFLCtCQUFBO0FBRUoiLCJmaWxlIjoiYXBwLmNvbXBvbmVudC5zY3NzIiwic291cmNlc0NvbnRlbnQiOlsiaGVhZGVyIHtcbiAgaGVpZ2h0OiA2NHB4O1xufVxuXG4ubWFpbi1jb250ZW50IHtcbiAgaGVpZ2h0OiBjYWxjKDEwMHZoIC0gODVweCk7XG59XG5cbi5jZWxsIHtcbiAgYmFja2dyb3VuZC1jb2xvcjogdHJhbnNwYXJlbnQ7XG4gIGJvcmRlcjogbm9uZTtcbiAgYm9yZGVyLXRvcDogNHB4IHNvbGlkICM0NTQ1NDU7XG4gIHBhZGRpbmc6IDIwcHg7XG4gICYuc2VydmljZXMge1xuICAgIGJvcmRlci1yaWdodDogNHB4IHNvbGlkICM0NTQ1NDU7XG4gIH1cbn1cbiJdfQ== */"] });
/*@__PURE__*/ (function () { _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵsetClassMetadata"](AppComponent, [{
        type: _angular_core__WEBPACK_IMPORTED_MODULE_0__["Component"],
        args: [{
                selector: 'app-root',
                templateUrl: './app.component.html',
                styleUrls: ['./app.component.scss']
            }]
    }], function () { return [{ type: _mila_service__WEBPACK_IMPORTED_MODULE_1__["MilaService"] }]; }, null); })();


/***/ }),

/***/ "ZAI4":
/*!*******************************!*\
  !*** ./src/app/app.module.ts ***!
  \*******************************/
/*! exports provided: AppModule */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "AppModule", function() { return AppModule; });
/* harmony import */ var _angular_platform_browser__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @angular/platform-browser */ "jhN1");
/* harmony import */ var _angular_core__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @angular/core */ "fXoL");
/* harmony import */ var _app_component__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./app.component */ "Sy1n");
/* harmony import */ var _nodes_list_nodes_list_component__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./nodes-list/nodes-list.component */ "lPRk");
/* harmony import */ var _events_log_events_log_component__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./events-log/events-log.component */ "h9jK");
/* harmony import */ var _angular_common_http__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @angular/common/http */ "tk/3");
/* harmony import */ var _3dgenomes_ngx_resizable__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @3dgenomes/ngx-resizable */ "ZySY");








class AppModule {
}
AppModule.ɵmod = _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵdefineNgModule"]({ type: AppModule, bootstrap: [_app_component__WEBPACK_IMPORTED_MODULE_2__["AppComponent"]] });
AppModule.ɵinj = _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵdefineInjector"]({ factory: function AppModule_Factory(t) { return new (t || AppModule)(); }, providers: [], imports: [[
            _angular_platform_browser__WEBPACK_IMPORTED_MODULE_0__["BrowserModule"],
            _angular_common_http__WEBPACK_IMPORTED_MODULE_5__["HttpClientModule"],
            _3dgenomes_ngx_resizable__WEBPACK_IMPORTED_MODULE_6__["NgxResizableModule"],
        ]] });
(function () { (typeof ngJitMode === "undefined" || ngJitMode) && _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵsetNgModuleScope"](AppModule, { declarations: [_app_component__WEBPACK_IMPORTED_MODULE_2__["AppComponent"],
        _nodes_list_nodes_list_component__WEBPACK_IMPORTED_MODULE_3__["NodesListComponent"],
        _events_log_events_log_component__WEBPACK_IMPORTED_MODULE_4__["EventsLogComponent"]], imports: [_angular_platform_browser__WEBPACK_IMPORTED_MODULE_0__["BrowserModule"],
        _angular_common_http__WEBPACK_IMPORTED_MODULE_5__["HttpClientModule"],
        _3dgenomes_ngx_resizable__WEBPACK_IMPORTED_MODULE_6__["NgxResizableModule"]] }); })();
/*@__PURE__*/ (function () { _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵsetClassMetadata"](AppModule, [{
        type: _angular_core__WEBPACK_IMPORTED_MODULE_1__["NgModule"],
        args: [{
                declarations: [
                    _app_component__WEBPACK_IMPORTED_MODULE_2__["AppComponent"],
                    _nodes_list_nodes_list_component__WEBPACK_IMPORTED_MODULE_3__["NodesListComponent"],
                    _events_log_events_log_component__WEBPACK_IMPORTED_MODULE_4__["EventsLogComponent"]
                ],
                imports: [
                    _angular_platform_browser__WEBPACK_IMPORTED_MODULE_0__["BrowserModule"],
                    _angular_common_http__WEBPACK_IMPORTED_MODULE_5__["HttpClientModule"],
                    _3dgenomes_ngx_resizable__WEBPACK_IMPORTED_MODULE_6__["NgxResizableModule"],
                ],
                providers: [],
                bootstrap: [_app_component__WEBPACK_IMPORTED_MODULE_2__["AppComponent"]]
            }]
    }], null, null); })();


/***/ }),

/***/ "h9jK":
/*!****************************************************!*\
  !*** ./src/app/events-log/events-log.component.ts ***!
  \****************************************************/
/*! exports provided: EventsLogComponent */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "EventsLogComponent", function() { return EventsLogComponent; });
/* harmony import */ var _angular_core__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @angular/core */ "fXoL");
/* harmony import */ var _mila_service__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../mila.service */ "Bhgz");
/* harmony import */ var _angular_common__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @angular/common */ "ofXK");




function EventsLogComponent_li_4_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "li");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](1, "span", 2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](3, "span", 3);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](4);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](5, "span", 4);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](6);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelement"](7, "span", 5);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
} if (rf & 2) {
    const log_r1 = ctx.$implicit;
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngClass", log_r1.class);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtextInterpolate1"]("[", log_r1.level, "]");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtextInterpolate"](log_r1.date);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtextInterpolate1"]("(", log_r1.scope, ")");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("innerHTML", log_r1.args, _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵsanitizeHtml"]);
} }
class EventsLogComponent {
    constructor(mila) {
        this.mila = mila;
        this.levels = ['info', 'warn', 'error'];
    }
    ngOnInit() {
        this.mila.log$.subscribe((logs) => {
            this.logs = logs.filter(l => this.levels.includes(l.level));
            console.log('scrolling');
            setTimeout(() => {
                const elt = document.getElementById('events-log');
                elt.scrollTo({ behavior: 'smooth', top: elt.scrollHeight - elt.clientHeight });
            }, 0);
        });
        this.mila.getLogs();
    }
}
EventsLogComponent.ɵfac = function EventsLogComponent_Factory(t) { return new (t || EventsLogComponent)(_angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵdirectiveInject"](_mila_service__WEBPACK_IMPORTED_MODULE_1__["MilaService"])); };
EventsLogComponent.ɵcmp = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵdefineComponent"]({ type: EventsLogComponent, selectors: [["app-events-log"]], decls: 5, vars: 1, consts: [["id", "events-log"], [4, "ngFor", "ngForOf"], [1, "level", 3, "ngClass"], [1, "date"], [1, "scope"], [1, "args", 3, "innerHTML"]], template: function EventsLogComponent_Template(rf, ctx) { if (rf & 1) {
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "section");
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](1, "h3");
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](2, "Events log");
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](3, "ul", 0);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](4, EventsLogComponent_li_4_Template, 8, 5, "li", 1);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    } if (rf & 2) {
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](4);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngForOf", ctx.logs);
    } }, directives: [_angular_common__WEBPACK_IMPORTED_MODULE_2__["NgForOf"], _angular_common__WEBPACK_IMPORTED_MODULE_2__["NgClass"]], styles: ["section[_ngcontent-%COMP%] {\n  height: calc(100vh - 120px);\n}\n\nul[_ngcontent-%COMP%] {\n  height: calc(100vh - 175px);\n  overflow-y: scroll;\n}\n\nspan[_ngcontent-%COMP%] {\n  margin: 0 2px;\n}\n\n.level.cyan[_ngcontent-%COMP%] {\n  color: #00e5ff;\n}\n\n.level.blue[_ngcontent-%COMP%] {\n  color: #3d5afe;\n}\n\n.level.green[_ngcontent-%COMP%] {\n  color: #b0ff57;\n}\n\n.level.orange[_ngcontent-%COMP%] {\n  color: #ffc400;\n}\n\n.level.red[_ngcontent-%COMP%] {\n  color: #ff1744;\n}\n\n.date[_ngcontent-%COMP%] {\n  color: #616161;\n}\n\n.scope[_ngcontent-%COMP%] {\n  font-weight: bold;\n  color: white;\n}\n/*# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImV2ZW50cy1sb2cvZXZlbnRzLWxvZy5jb21wb25lbnQuc2NzcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtFQUNFLDJCQUFBO0FBQ0Y7O0FBRUE7RUFDRSwyQkFBQTtFQUNBLGtCQUFBO0FBQ0Y7O0FBRUE7RUFDRSxhQUFBO0FBQ0Y7O0FBR0U7RUFDRSxjQUFBO0FBQUo7O0FBRUU7RUFDRSxjQUFBO0FBQUo7O0FBRUU7RUFDRSxjQUFBO0FBQUo7O0FBRUU7RUFDRSxjQUFBO0FBQUo7O0FBRUU7RUFDRSxjQUFBO0FBQUo7O0FBSUE7RUFDRSxjQUFBO0FBREY7O0FBSUE7RUFDRSxpQkFBQTtFQUNBLFlBQUE7QUFERiIsImZpbGUiOiJldmVudHMtbG9nL2V2ZW50cy1sb2cuY29tcG9uZW50LnNjc3MiLCJzb3VyY2VzQ29udGVudCI6WyJzZWN0aW9uIHtcbiAgaGVpZ2h0OiBjYWxjKDEwMHZoIC0gMTIwcHgpO1xufVxuXG51bCB7XG4gIGhlaWdodDogY2FsYygxMDB2aCAtIDE3NXB4KTtcbiAgb3ZlcmZsb3cteTogc2Nyb2xsO1xufVxuXG5zcGFuIHtcbiAgbWFyZ2luOiAwIDJweDtcbn1cblxuLmxldmVsIHtcbiAgJi5jeWFuIHtcbiAgICBjb2xvcjogIzAwZTVmZjtcbiAgfVxuICAmLmJsdWUge1xuICAgIGNvbG9yOiAjM2Q1YWZlO1xuICB9XG4gICYuZ3JlZW4ge1xuICAgIGNvbG9yOiAjYjBmZjU3O1xuICB9XG4gICYub3JhbmdlIHtcbiAgICBjb2xvcjogI2ZmYzQwMDtcbiAgfVxuICAmLnJlZCB7XG4gICAgY29sb3I6ICNmZjE3NDQ7XG4gIH1cbn1cblxuLmRhdGUge1xuICBjb2xvcjogIzYxNjE2MTtcbn1cblxuLnNjb3BlIHtcbiAgZm9udC13ZWlnaHQ6IGJvbGQ7XG4gIGNvbG9yOiB3aGl0ZTtcbn1cbiJdfQ== */"] });
/*@__PURE__*/ (function () { _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵsetClassMetadata"](EventsLogComponent, [{
        type: _angular_core__WEBPACK_IMPORTED_MODULE_0__["Component"],
        args: [{
                selector: 'app-events-log',
                templateUrl: './events-log.component.html',
                styleUrls: ['./events-log.component.scss']
            }]
    }], function () { return [{ type: _mila_service__WEBPACK_IMPORTED_MODULE_1__["MilaService"] }]; }, null); })();


/***/ }),

/***/ "lPRk":
/*!****************************************************!*\
  !*** ./src/app/nodes-list/nodes-list.component.ts ***!
  \****************************************************/
/*! exports provided: NodesListComponent */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "NodesListComponent", function() { return NodesListComponent; });
/* harmony import */ var _angular_core__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @angular/core */ "fXoL");
/* harmony import */ var _mila_service__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../mila.service */ "Bhgz");
/* harmony import */ var _angular_common__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @angular/common */ "ofXK");




function NodesListComponent_li_4_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "li");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](1, "span", 3);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](3, "span", 4);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](4);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
} if (rf & 2) {
    const pkg_r2 = ctx.$implicit;
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtextInterpolate"](pkg_r2.name);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngClass", pkg_r2.compilationClass);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtextInterpolate"](pkg_r2.compilationStatus);
} }
function NodesListComponent_li_8_span_3_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "span", 7);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](1, "Disabled");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
} }
function NodesListComponent_li_8_span_4_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "span", 4);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
} if (rf & 2) {
    const service_r3 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"]().$implicit;
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngClass", service_r3.compilationClass);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtextInterpolate"](service_r3.compilationStatus);
} }
function NodesListComponent_li_8_span_5_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "span", 4);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
} if (rf & 2) {
    const service_r3 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"]().$implicit;
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngClass", service_r3.statusClass);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtextInterpolate"](service_r3.status);
} }
function NodesListComponent_li_8_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "li");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](1, "span", 3);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](3, NodesListComponent_li_8_span_3_Template, 2, 0, "span", 5);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](4, NodesListComponent_li_8_span_4_Template, 2, 2, "span", 6);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](5, NodesListComponent_li_8_span_5_Template, 2, 2, "span", 6);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
} if (rf & 2) {
    const service_r3 = ctx.$implicit;
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtextInterpolate"](service_r3.name);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngIf", service_r3.disabled);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngIf", !service_r3.disabled);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngIf", !service_r3.disabled);
} }
class NodesListComponent {
    constructor(mila) {
        this.mila = mila;
    }
    ngOnInit() {
        this.mila.packages$.subscribe((p) => this.packages = p);
        this.mila.services$.subscribe((s) => this.services = s);
        this.mila.getGraph();
    }
}
NodesListComponent.ɵfac = function NodesListComponent_Factory(t) { return new (t || NodesListComponent)(_angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵdirectiveInject"](_mila_service__WEBPACK_IMPORTED_MODULE_1__["MilaService"])); };
NodesListComponent.ɵcmp = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵdefineComponent"]({ type: NodesListComponent, selectors: [["app-nodes-list"]], decls: 9, vars: 2, consts: [[1, "packages"], [4, "ngFor", "ngForOf"], [1, "services"], [1, "name"], [1, "status", 3, "ngClass"], ["class", "status", 4, "ngIf"], ["class", "status", 3, "ngClass", 4, "ngIf"], [1, "status"]], template: function NodesListComponent_Template(rf, ctx) { if (rf & 1) {
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "section");
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](1, "h3");
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](2, "Shared packages");
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](3, "ul", 0);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](4, NodesListComponent_li_4_Template, 5, 3, "li", 1);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](5, "h3");
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](6, "Services");
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](7, "ul", 2);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](8, NodesListComponent_li_8_Template, 6, 4, "li", 1);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    } if (rf & 2) {
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](4);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngForOf", ctx.packages);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](4);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngForOf", ctx.services);
    } }, directives: [_angular_common__WEBPACK_IMPORTED_MODULE_2__["NgForOf"], _angular_common__WEBPACK_IMPORTED_MODULE_2__["NgClass"], _angular_common__WEBPACK_IMPORTED_MODULE_2__["NgIf"]], styles: ["section[_ngcontent-%COMP%] {\n  min-width: 400px;\n  height: calc(100vh - 120px);\n  overflow-y: scroll;\n}\n\nul[_ngcontent-%COMP%]   li[_ngcontent-%COMP%] {\n  margin: 5px 0;\n}\n\nul[_ngcontent-%COMP%]   span[_ngcontent-%COMP%] {\n  font-size: 10pt;\n  margin: 0 2px;\n}\n\nul[_ngcontent-%COMP%]   span.status[_ngcontent-%COMP%] {\n  padding: 2px 5px;\n  background-color: #616161;\n  border-radius: 5px;\n}\n\nul[_ngcontent-%COMP%]   span.status.red[_ngcontent-%COMP%] {\n  background-color: #e53935;\n}\n\nul[_ngcontent-%COMP%]   span.status.bright-red[_ngcontent-%COMP%] {\n  background-color: #ff1744;\n}\n\nul[_ngcontent-%COMP%]   span.status.green[_ngcontent-%COMP%] {\n  background-color: #43a047;\n}\n\nul[_ngcontent-%COMP%]   span.status.blue[_ngcontent-%COMP%] {\n  background-color: #1565c0;\n}\n/*# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVzLWxpc3Qvbm9kZXMtbGlzdC5jb21wb25lbnQuc2NzcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFNQTtFQUNFLGdCQUFBO0VBQ0EsMkJBQUE7RUFDQSxrQkFBQTtBQUxGOztBQVNFO0VBQ0UsYUFBQTtBQU5KOztBQVFFO0VBQ0UsZUFBQTtFQUNBLGFBQUE7QUFOSjs7QUFRRTtFQUNFLGdCQUFBO0VBQ0EseUJBcEJHO0VBcUJILGtCQUFBO0FBTko7O0FBT0k7RUFDRSx5QkF6QkE7QUFvQk47O0FBT0k7RUFDRSx5QkEzQk87QUFzQmI7O0FBT0k7RUFDRSx5QkE1QkU7QUF1QlI7O0FBT0k7RUFDRSx5QkE5QkM7QUF5QlAiLCJmaWxlIjoibm9kZXMtbGlzdC9ub2Rlcy1saXN0LmNvbXBvbmVudC5zY3NzIiwic291cmNlc0NvbnRlbnQiOlsiJHJlZDogI2U1MzkzNTtcbiRicmlnaHQtcmVkOiAjZmYxNzQ0O1xuJGdyZXk6ICM2MTYxNjE7XG4kZ3JlZW46ICM0M2EwNDc7XG4kYmx1ZTogIzE1NjVjMDtcblxuc2VjdGlvbiB7XG4gIG1pbi13aWR0aDogNDAwcHg7XG4gIGhlaWdodDogY2FsYygxMDB2aCAtIDEyMHB4KTtcbiAgb3ZlcmZsb3cteTogc2Nyb2xsO1xufVxuXG51bCB7XG4gIGxpIHtcbiAgICBtYXJnaW46IDVweCAwO1xuICB9XG4gIHNwYW4ge1xuICAgIGZvbnQtc2l6ZTogMTBwdDtcbiAgICBtYXJnaW46IDAgMnB4O1xuICB9XG4gIHNwYW4uc3RhdHVzIHtcbiAgICBwYWRkaW5nOiAycHggNXB4O1xuICAgIGJhY2tncm91bmQtY29sb3I6ICRncmV5O1xuICAgIGJvcmRlci1yYWRpdXM6IDVweDtcbiAgICAmLnJlZCB7XG4gICAgICBiYWNrZ3JvdW5kLWNvbG9yOiAkcmVkO1xuICAgIH1cbiAgICAmLmJyaWdodC1yZWQge1xuICAgICAgYmFja2dyb3VuZC1jb2xvcjogJGJyaWdodC1yZWQ7XG4gICAgfVxuICAgICYuZ3JlZW4ge1xuICAgICAgYmFja2dyb3VuZC1jb2xvcjogJGdyZWVuO1xuICAgIH1cbiAgICAmLmJsdWUge1xuICAgICAgYmFja2dyb3VuZC1jb2xvcjogJGJsdWU7XG4gICAgfVxuICB9XG59XG4iXX0= */"] });
/*@__PURE__*/ (function () { _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵsetClassMetadata"](NodesListComponent, [{
        type: _angular_core__WEBPACK_IMPORTED_MODULE_0__["Component"],
        args: [{
                selector: 'app-nodes-list',
                templateUrl: './nodes-list.component.html',
                styleUrls: ['./nodes-list.component.scss']
            }]
    }], function () { return [{ type: _mila_service__WEBPACK_IMPORTED_MODULE_1__["MilaService"] }]; }, null); })();


/***/ }),

/***/ "zUnb":
/*!*********************!*\
  !*** ./src/main.ts ***!
  \*********************/
/*! no exports provided */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _angular_core__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @angular/core */ "fXoL");
/* harmony import */ var _environments_environment__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./environments/environment */ "AytR");
/* harmony import */ var _app_app_module__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./app/app.module */ "ZAI4");
/* harmony import */ var _angular_platform_browser__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @angular/platform-browser */ "jhN1");




if (_environments_environment__WEBPACK_IMPORTED_MODULE_1__["environment"].production) {
    Object(_angular_core__WEBPACK_IMPORTED_MODULE_0__["enableProdMode"])();
}
_angular_platform_browser__WEBPACK_IMPORTED_MODULE_3__["platformBrowser"]().bootstrapModule(_app_app_module__WEBPACK_IMPORTED_MODULE_2__["AppModule"])
    .catch(err => console.error(err));


/***/ }),

/***/ "zn8P":
/*!******************************************************!*\
  !*** ./$$_lazy_route_resource lazy namespace object ***!
  \******************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

function webpackEmptyAsyncContext(req) {
	// Here Promise.resolve().then() is used instead of new Promise() to prevent
	// uncaught exception popping up in devtools
	return Promise.resolve().then(function() {
		var e = new Error("Cannot find module '" + req + "'");
		e.code = 'MODULE_NOT_FOUND';
		throw e;
	});
}
webpackEmptyAsyncContext.keys = function() { return []; };
webpackEmptyAsyncContext.resolve = webpackEmptyAsyncContext;
module.exports = webpackEmptyAsyncContext;
webpackEmptyAsyncContext.id = "zn8P";

/***/ })

},[[0,"runtime","vendor"]]]);
//# sourceMappingURL=main.js.map