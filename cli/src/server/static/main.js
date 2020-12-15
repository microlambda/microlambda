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

/***/ "2UJW":
/*!*********************************!*\
  !*** ./src/app/tabs.service.ts ***!
  \*********************************/
/*! exports provided: TabsService */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "TabsService", function() { return TabsService; });
/* harmony import */ var _angular_core__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @angular/core */ "fXoL");
/* harmony import */ var rxjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! rxjs */ "qCKp");
/* harmony import */ var _mila_service__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./mila.service */ "Bhgz");




const DEFAULT_TAB = {
    name: 'Events log',
    type: 'events-log',
    closable: false,
};
const DEFAULT_TABS = [
    DEFAULT_TAB,
    {
        name: 'Binaries versions',
        type: 'binaries',
        closable: false,
    },
    {
        name: 'Lerna graph',
        type: 'lerna-graph',
        closable: false,
    }
];
class TabsService {
    constructor(mila) {
        this.mila = mila;
        this._currentTab$ = new rxjs__WEBPACK_IMPORTED_MODULE_1__["BehaviorSubject"](DEFAULT_TAB);
        this._tabs$ = new rxjs__WEBPACK_IMPORTED_MODULE_1__["BehaviorSubject"](DEFAULT_TABS);
        this._history = [DEFAULT_TAB];
        this.tabs$ = this._tabs$.asObservable();
        this.currentTab$ = this._currentTab$.asObservable();
    }
    openTab(type, name) {
        const tabs = [...this._tabs$.getValue()];
        const newTab = {
            type,
            name,
            closable: true,
        };
        if (!tabs.find(t => t.name === name)) {
            tabs.push(newTab);
            this._tabs$.next(tabs);
        }
        this.selectTab(newTab);
    }
    selectTab(tab) {
        this._history.push(tab);
        this._currentTab$.next(tab);
        if (tab.type === 'service-logs') {
            this.mila.selectService(tab.name.match(/^Logs \| (.+)$/)[1]);
        }
        if (tab.type === 'tsc-logs') {
            this.mila.setCurrentNode(tab.name.match(/^(.+) \| tsc$/)[1]);
        }
    }
    deleteTab(name) {
        const tabs = [...this._tabs$.getValue()];
        this._tabs$.next(tabs.filter(t => t.name !== name));
        if (this._history.length > 2) {
            this._history.pop();
            const previous = this._history.pop();
            this._currentTab$.next(previous);
        }
        else {
            this._history = [];
            this.selectTab(DEFAULT_TAB);
        }
    }
}
TabsService.ɵfac = function TabsService_Factory(t) { return new (t || TabsService)(_angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵinject"](_mila_service__WEBPACK_IMPORTED_MODULE_2__["MilaService"])); };
TabsService.ɵprov = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵdefineInjectable"]({ token: TabsService, factory: TabsService.ɵfac, providedIn: 'root' });
/*@__PURE__*/ (function () { _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵsetClassMetadata"](TabsService, [{
        type: _angular_core__WEBPACK_IMPORTED_MODULE_0__["Injectable"],
        args: [{
                providedIn: 'root'
            }]
    }], function () { return [{ type: _mila_service__WEBPACK_IMPORTED_MODULE_2__["MilaService"] }]; }, null); })();


/***/ }),

/***/ "5tzZ":
/*!************************************************!*\
  !*** ./src/app/tsc-logs/tsc-logs.component.ts ***!
  \************************************************/
/*! exports provided: TscLogsComponent */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "TscLogsComponent", function() { return TscLogsComponent; });
/* harmony import */ var _angular_core__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @angular/core */ "fXoL");
/* harmony import */ var _mila_service__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../mila.service */ "Bhgz");
/* harmony import */ var _safe_html_pipe__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../safe-html.pipe */ "ZJwn");




class TscLogsComponent {
    constructor(mila) {
        this.mila = mila;
    }
    ngOnInit() {
        this.mila.getTscLogs().subscribe((log) => {
            this.log = log;
            this._scrollToEnd();
        });
    }
    _scrollToEnd() {
        console.log('scrolling');
        setTimeout(() => {
            const elt = document.getElementById('service-logs');
            elt.scrollTo({ behavior: 'smooth', top: elt.scrollHeight - elt.clientHeight });
        }, 0);
    }
}
TscLogsComponent.ɵfac = function TscLogsComponent_Factory(t) { return new (t || TscLogsComponent)(_angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵdirectiveInject"](_mila_service__WEBPACK_IMPORTED_MODULE_1__["MilaService"])); };
TscLogsComponent.ɵcmp = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵdefineComponent"]({ type: TscLogsComponent, selectors: [["app-tsc-logs"]], decls: 5, vars: 4, consts: [["id", "service-logs", 1, "mono", 3, "innerHTML"]], template: function TscLogsComponent_Template(rf, ctx) { if (rf & 1) {
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "section");
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](1, "h3");
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](2);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelement"](3, "div", 0);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵpipe"](4, "safeHtml");
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    } if (rf & 2) {
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](2);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtextInterpolate1"]("", ctx.mila.currentNode, " logs");
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("innerHTML", _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵpipeBind1"](4, 2, ctx.log), _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵsanitizeHtml"]);
    } }, pipes: [_safe_html_pipe__WEBPACK_IMPORTED_MODULE_2__["SafeHtmlPipe"]], styles: ["section[_ngcontent-%COMP%] {\n  padding: 10px;\n}\n\n.mono[_ngcontent-%COMP%] {\n  height: calc(100vh - 175px);\n  overflow-y: scroll;\n}\n/*# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInNyYy9hcHAvdHNjLWxvZ3MvdHNjLWxvZ3MuY29tcG9uZW50LnNjc3MiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7RUFDRSxhQUFBO0FBQ0Y7O0FBRUE7RUFDRSwyQkFBQTtFQUNBLGtCQUFBO0FBQ0YiLCJmaWxlIjoic3JjL2FwcC90c2MtbG9ncy90c2MtbG9ncy5jb21wb25lbnQuc2NzcyIsInNvdXJjZXNDb250ZW50IjpbInNlY3Rpb24ge1xuICBwYWRkaW5nOiAxMHB4O1xufVxuXG4ubW9ubyB7XG4gIGhlaWdodDogY2FsYygxMDB2aCAtIDE3NXB4KTtcbiAgb3ZlcmZsb3cteTogc2Nyb2xsO1xufVxuIl19 */"] });
/*@__PURE__*/ (function () { _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵsetClassMetadata"](TscLogsComponent, [{
        type: _angular_core__WEBPACK_IMPORTED_MODULE_0__["Component"],
        args: [{
                selector: 'app-tsc-logs',
                templateUrl: './tsc-logs.component.html',
                styleUrls: ['./tsc-logs.component.scss']
            }]
    }], function () { return [{ type: _mila_service__WEBPACK_IMPORTED_MODULE_1__["MilaService"] }]; }, null); })();


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
/*! exports provided: TranspilingStatus, TypeCheckStatus */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "TranspilingStatus", function() { return TranspilingStatus; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "TypeCheckStatus", function() { return TypeCheckStatus; });
// TODO: Import from back
/**
 * For performance reasons transpiling (only emit js from ts) is performed in a separate thread than
 * type checking (ensure correct types are used and there will be no type errors at run time)
 */
var TranspilingStatus;
(function (TranspilingStatus) {
    TranspilingStatus[TranspilingStatus["NOT_TRANSPILED"] = 0] = "NOT_TRANSPILED";
    TranspilingStatus[TranspilingStatus["TRANSPILING"] = 1] = "TRANSPILING";
    TranspilingStatus[TranspilingStatus["TRANSPILED"] = 2] = "TRANSPILED";
    TranspilingStatus[TranspilingStatus["ERROR_TRANSPILING"] = 3] = "ERROR_TRANSPILING";
})(TranspilingStatus || (TranspilingStatus = {}));
var TypeCheckStatus;
(function (TypeCheckStatus) {
    TypeCheckStatus[TypeCheckStatus["NOT_CHECKED"] = 0] = "NOT_CHECKED";
    TypeCheckStatus[TypeCheckStatus["CHECKING"] = 1] = "CHECKING";
    TypeCheckStatus[TypeCheckStatus["SUCCESS"] = 2] = "SUCCESS";
    TypeCheckStatus[TypeCheckStatus["ERROR"] = 3] = "ERROR";
})(TypeCheckStatus || (TypeCheckStatus = {}));


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
        this._transpiled = node.transpiled;
        this._typeChecked = node.typeChecked;
        this._lastTypeCheck = node.lastTypeCheck;
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
    get lastTypeCheck() {
        return this._lastTypeCheck;
    }
    get transpiled() {
        switch (this._transpiled) {
            case _compilation_status_enum__WEBPACK_IMPORTED_MODULE_0__["TranspilingStatus"].TRANSPILED:
                return 'Transpiled';
            case _compilation_status_enum__WEBPACK_IMPORTED_MODULE_0__["TranspilingStatus"].TRANSPILING:
                return 'Transpiling';
            case _compilation_status_enum__WEBPACK_IMPORTED_MODULE_0__["TranspilingStatus"].ERROR_TRANSPILING:
                return 'Error transpiling';
            case _compilation_status_enum__WEBPACK_IMPORTED_MODULE_0__["TranspilingStatus"].NOT_TRANSPILED:
                return 'Not transpiled';
        }
    }
    get typeChecked() {
        switch (this._typeChecked) {
            case _compilation_status_enum__WEBPACK_IMPORTED_MODULE_0__["TypeCheckStatus"].CHECKING:
                return 'Typechecking';
            case _compilation_status_enum__WEBPACK_IMPORTED_MODULE_0__["TypeCheckStatus"].NOT_CHECKED:
                return 'No type-checking';
            case _compilation_status_enum__WEBPACK_IMPORTED_MODULE_0__["TypeCheckStatus"].ERROR:
                return 'Type errors';
            case _compilation_status_enum__WEBPACK_IMPORTED_MODULE_0__["TypeCheckStatus"].SUCCESS:
                return 'Type checked';
        }
    }
    get transpiledClass() {
        switch (this._transpiled) {
            case _compilation_status_enum__WEBPACK_IMPORTED_MODULE_0__["TranspilingStatus"].TRANSPILED:
                return 'green';
            case _compilation_status_enum__WEBPACK_IMPORTED_MODULE_0__["TranspilingStatus"].TRANSPILING:
                return 'blue';
            case _compilation_status_enum__WEBPACK_IMPORTED_MODULE_0__["TranspilingStatus"].ERROR_TRANSPILING:
                return 'bright-red';
            case _compilation_status_enum__WEBPACK_IMPORTED_MODULE_0__["TranspilingStatus"].NOT_TRANSPILED:
                return 'grey';
        }
    }
    get typeCheckClass() {
        switch (this._typeChecked) {
            case _compilation_status_enum__WEBPACK_IMPORTED_MODULE_0__["TypeCheckStatus"].CHECKING:
                return 'blue';
            case _compilation_status_enum__WEBPACK_IMPORTED_MODULE_0__["TypeCheckStatus"].NOT_CHECKED:
                return 'grey';
            case _compilation_status_enum__WEBPACK_IMPORTED_MODULE_0__["TypeCheckStatus"].ERROR:
                return 'bright-red';
            case _compilation_status_enum__WEBPACK_IMPORTED_MODULE_0__["TypeCheckStatus"].SUCCESS:
                return 'green';
        }
    }
    get isService() {
        return false;
    }
    get notChecked() {
        return this._typeChecked === _compilation_status_enum__WEBPACK_IMPORTED_MODULE_0__["TypeCheckStatus"].NOT_CHECKED;
    }
    get checking() {
        return this._typeChecked === _compilation_status_enum__WEBPACK_IMPORTED_MODULE_0__["TypeCheckStatus"].CHECKING;
    }
    setTranspilingStatus(status) {
        this._transpiled = status;
    }
    setTypeCheckStatus(status) {
        this._typeChecked = status;
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
/* harmony import */ var rxjs_operators__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! rxjs/operators */ "kU1M");
/* harmony import */ var ansi_to_html__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ansi-to-html */ "YavU");
/* harmony import */ var ansi_to_html__WEBPACK_IMPORTED_MODULE_8___default = /*#__PURE__*/__webpack_require__.n(ansi_to_html__WEBPACK_IMPORTED_MODULE_8__);
/* harmony import */ var _angular_common_http__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @angular/common/http */ "tk/3");











const convert = new ansi_to_html__WEBPACK_IMPORTED_MODULE_8__();
/**
 * - Filterable events log => TODO perf issue: see how to mitigate it (lazy-load elt in DOM with infinite scroll)
 * - Compilation Logs => TODO In CLI put the compilation logs in memory maps that can be queryable from client. Try to preserve ANSI colors and convert to HTML
 * - Start / Stop / Restart => TODO possibility to stop in starting state
 * - Change port => TODO: Same, also create a socket event to update service port in client
 * - Test => TODO Run tests (unit, functional or both) and print output in a web TTY (https://xtermjs.org/)
 * - Package tree => TODO put packagr v2 in codebase and use script and tree-shaking on demand (on HTTP call) to return tree-shaken deps
 * - Package / Deploy => TODO create UI to easily package and deploy services (input aws-region etc...)
 * - Default region / AWS credentials => TODO: Create a screen to see which key pair / profile and default region is currently used
 * - Binaries Versions => TODO: Create a endpoint to see binary path and version (tsc, sls, jest)
 * - Lerna Graph => TODO: Use a graph lib (D3 cola.js ?) to print graph in a Airflow DAG way
 * - Resources consumption => TODO Use https://www.npmjs.com/package/pidusage to send resource usage too the front and print them in beautiful D3 charts
 * - Make closable + button add => TODO: Make generic tab (event logs, binary versions etc...) closable and add a button add at the end of toolbar to re-open them
 * - Tab Config used => TODO create a tab printing the currently used .microlambdarc config
 * - Improve terminal based tasks with https://xtermjs.org/
 */
const BASE_URL = _environments_environment__WEBPACK_IMPORTED_MODULE_1__["environment"].production ? window.origin : `http://localhost:${_environments_environment__WEBPACK_IMPORTED_MODULE_1__["environment"].port}`;
const EMPTY_LOGS = { deploy: [], createDoain: [], offline: [] };
class MilaService {
    constructor(http) {
        this.http = http;
        this._connected$ = new rxjs__WEBPACK_IMPORTED_MODULE_2__["BehaviorSubject"](false);
        this._packages$ = new rxjs__WEBPACK_IMPORTED_MODULE_2__["BehaviorSubject"]([]);
        this._services$ = new rxjs__WEBPACK_IMPORTED_MODULE_2__["BehaviorSubject"]([]);
        this._logs$ = new rxjs__WEBPACK_IMPORTED_MODULE_2__["BehaviorSubject"]([]);
        this._currentService$ = new rxjs__WEBPACK_IMPORTED_MODULE_2__["BehaviorSubject"](null);
        this._serviceLogs$ = new rxjs__WEBPACK_IMPORTED_MODULE_2__["BehaviorSubject"](EMPTY_LOGS);
        // FIXME: Change url
        this._socket = socket_io_client__WEBPACK_IMPORTED_MODULE_3__('http://localhost:4545');
        this.packages$ = this._packages$.asObservable();
        this.services$ = this._services$.asObservable();
        this.log$ = this._logs$.asObservable();
        this.connected$ = this._connected$.asObservable();
        this.currentService$ = this._currentService$.asObservable();
        this.serviceLogs$ = this._serviceLogs$.asObservable();
        this._socket.on('connect', () => {
            console.debug('connected to mila server');
            this._connected$.next(true);
        });
        this._socket.on('disconnect', () => {
            console.debug('disconnected to mila server');
            this._connected$.next(false);
        });
        const findNode = (node) => {
            const isService = this._services$.getValue().some(s => s.name === node);
            const obs = isService ? this._services$ : this._packages$;
            const nodes = [...obs.getValue()];
            const toUpdate = nodes.find(s => s.name === node);
            if (!toUpdate) {
                throw Error('No node found');
            }
            return { obs, toUpdate, nodes };
        };
        this._socket.on('transpiling.status.updated', (data) => {
            console.debug('received transpiling event', data);
            const { obs, toUpdate, nodes } = findNode(data.node);
            toUpdate.setTranspilingStatus(data.status);
            obs.next(nodes);
            console.debug('nodes updated', nodes);
        });
        this._socket.on('type.checking.status.updated', (data) => {
            console.debug('received type check event', data);
            const { obs, toUpdate, nodes } = findNode(data.node);
            toUpdate.setTypeCheckStatus(data.status);
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
        this.services$.subscribe((services) => {
            const currentServiceName = this._currentService$.getValue();
            const currentService = currentServiceName ? services.find(s => s.name === currentServiceName) : null;
            if (currentService && currentService.status !== 'Running') {
                this._serviceLogs$.next(EMPTY_LOGS);
            }
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
            console.debug('Received logs', logs.length);
            this._logs$.next(logs.map(l => new _log__WEBPACK_IMPORTED_MODULE_6__["Log"](l)));
        });
    }
    getNode(name) {
        const pkg = this._packages$.getValue().find(p => p.name === name);
        if (pkg) {
            return pkg;
        }
        return this._services$.getValue().find(p => p.name === name);
    }
    selectService(name) {
        if (this._currentService$.getValue()) {
            this._socket.off(`${this._currentService$.getValue()}.log.added`);
        }
        this._serviceLogs$.next(EMPTY_LOGS);
        this._currentService$.next(name);
        this._socket.emit('send.service.logs', name);
        this.http.get(`${BASE_URL}/api/services/${encodeURIComponent(name)}/logs`).subscribe((data) => {
            this._serviceLogs$.next(data);
            this._socket.on(`${name}.log.added`, (data) => {
                console.log('Logs received for current service', data);
                const logs = this._serviceLogs$.getValue();
                logs.offline.push(data);
                this._serviceLogs$.next(logs);
            });
        });
    }
    setCurrentNode(node) { this._currentNode = node; }
    get currentNode() { return this._currentNode; }
    getTscLogs() {
        return this.http.get(`${BASE_URL}/api/nodes/${encodeURIComponent(this._currentNode)}/tsc/logs`).pipe(Object(rxjs_operators__WEBPACK_IMPORTED_MODULE_7__["map"])((data) => {
            return convert.toHtml(data.join('').replace(/(\r\n|\n|\r)/gm, "<br />"));
        }));
    }
    start(service) {
        this._socket.emit('service.start', service);
    }
    stop(service) {
        this._socket.emit('service.stop', service);
    }
    restart(service) {
        this._socket.emit('service.restart', service);
    }
    compile(node, force) {
        this._socket.emit('node.compile', { node, force });
    }
}
MilaService.ɵfac = function MilaService_Factory(t) { return new (t || MilaService)(_angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵinject"](_angular_common_http__WEBPACK_IMPORTED_MODULE_9__["HttpClient"])); };
MilaService.ɵprov = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵdefineInjectable"]({ token: MilaService, factory: MilaService.ɵfac, providedIn: 'root' });
/*@__PURE__*/ (function () { _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵsetClassMetadata"](MilaService, [{
        type: _angular_core__WEBPACK_IMPORTED_MODULE_0__["Injectable"],
        args: [{
                providedIn: 'root'
            }]
    }], function () { return [{ type: _angular_common_http__WEBPACK_IMPORTED_MODULE_9__["HttpClient"] }]; }, null); })();


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

/***/ "DYO7":
/*!********************************************************!*\
  !*** ./src/app/node-details/node-details.component.ts ***!
  \********************************************************/
/*! exports provided: NodeDetailsComponent */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "NodeDetailsComponent", function() { return NodeDetailsComponent; });
/* harmony import */ var _angular_core__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @angular/core */ "fXoL");
/* harmony import */ var _fortawesome_free_solid_svg_icons__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @fortawesome/free-solid-svg-icons */ "wHSu");
/* harmony import */ var _tabs_service__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../tabs.service */ "2UJW");
/* harmony import */ var _mila_service__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../mila.service */ "Bhgz");
/* harmony import */ var _angular_common__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @angular/common */ "ofXK");
/* harmony import */ var _fortawesome_angular_fontawesome__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @fortawesome/angular-fontawesome */ "6NWb");







function NodeDetailsComponent_section_0_div_6_button_4_Template(rf, ctx) { if (rf & 1) {
    const _r12 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵgetCurrentView"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "button", 6);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵlistener"]("click", function NodeDetailsComponent_section_0_div_6_button_4_Template_button_click_0_listener() { _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵrestoreView"](_r12); const ctx_r11 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"](3); return ctx_r11.openTscLogs(); });
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelement"](1, "fa-icon", 7);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](2, "See tsc logs");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
} if (rf & 2) {
    const ctx_r5 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"](3);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("icon", ctx_r5.fa.tsc);
} }
function NodeDetailsComponent_section_0_div_6_button_5_Template(rf, ctx) { if (rf & 1) {
    const _r14 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵgetCurrentView"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "button", 6);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵlistener"]("click", function NodeDetailsComponent_section_0_div_6_button_5_Template_button_click_0_listener() { _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵrestoreView"](_r14); const ctx_r13 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"](3); return ctx_r13.mila.compile(ctx_r13.node.name, ctx_r13.node.isService); });
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelement"](1, "fa-icon", 7);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](2, "Compile");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
} if (rf & 2) {
    const ctx_r6 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"](3);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("icon", ctx_r6.fa.build);
} }
function NodeDetailsComponent_section_0_div_6_button_6_Template(rf, ctx) { if (rf & 1) {
    const _r16 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵgetCurrentView"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "button", 6);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵlistener"]("click", function NodeDetailsComponent_section_0_div_6_button_6_Template_button_click_0_listener() { _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵrestoreView"](_r16); const ctx_r15 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"](3); return ctx_r15.mila.compile(ctx_r15.node.name, true); });
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelement"](1, "fa-icon", 7);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](2, "Recompile");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
} if (rf & 2) {
    const ctx_r7 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"](3);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("icon", ctx_r7.fa.build);
} }
function NodeDetailsComponent_section_0_div_6_button_7_Template(rf, ctx) { if (rf & 1) {
    const _r18 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵgetCurrentView"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "button", 6);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵlistener"]("click", function NodeDetailsComponent_section_0_div_6_button_7_Template_button_click_0_listener() { _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵrestoreView"](_r18); const ctx_r17 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"](3); return ctx_r17.mila.start(ctx_r17.node.name); });
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelement"](1, "fa-icon", 7);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](2, "Start");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
} if (rf & 2) {
    const ctx_r8 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"](3);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("icon", ctx_r8.fa.start);
} }
function NodeDetailsComponent_section_0_div_6_button_8_Template(rf, ctx) { if (rf & 1) {
    const _r20 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵgetCurrentView"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "button", 10);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵlistener"]("click", function NodeDetailsComponent_section_0_div_6_button_8_Template_button_click_0_listener() { _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵrestoreView"](_r20); const ctx_r19 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"](3); return ctx_r19.mila.stop(ctx_r19.node.name); });
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelement"](1, "fa-icon", 7);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](2, "Stop");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
} if (rf & 2) {
    const ctx_r9 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"](3);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("icon", ctx_r9.fa.stop);
} }
function NodeDetailsComponent_section_0_div_6_button_9_Template(rf, ctx) { if (rf & 1) {
    const _r22 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵgetCurrentView"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "button", 6);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵlistener"]("click", function NodeDetailsComponent_section_0_div_6_button_9_Template_button_click_0_listener() { _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵrestoreView"](_r22); const ctx_r21 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"](3); return ctx_r21.mila.restart(ctx_r21.node.name); });
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelement"](1, "fa-icon", 7);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](2, "Restart");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
} if (rf & 2) {
    const ctx_r10 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"](3);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("icon", ctx_r10.fa.refresh);
} }
function NodeDetailsComponent_section_0_div_6_Template(rf, ctx) { if (rf & 1) {
    const _r24 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵgetCurrentView"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "div", 5);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](1, "button", 6);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵlistener"]("click", function NodeDetailsComponent_section_0_div_6_Template_button_click_1_listener() { _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵrestoreView"](_r24); const ctx_r23 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"](2); return ctx_r23.openLogs(); });
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelement"](2, "fa-icon", 7);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](3, "See logs");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](4, NodeDetailsComponent_section_0_div_6_button_4_Template, 3, 1, "button", 8);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](5, NodeDetailsComponent_section_0_div_6_button_5_Template, 3, 1, "button", 8);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](6, NodeDetailsComponent_section_0_div_6_button_6_Template, 3, 1, "button", 8);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](7, NodeDetailsComponent_section_0_div_6_button_7_Template, 3, 1, "button", 8);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](8, NodeDetailsComponent_section_0_div_6_button_8_Template, 3, 1, "button", 9);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](9, NodeDetailsComponent_section_0_div_6_button_9_Template, 3, 1, "button", 8);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
} if (rf & 2) {
    const ctx_r1 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("icon", ctx_r1.fa.logs);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngIf", !ctx_r1.node.notChecked && !ctx_r1.node.checking);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngIf", ctx_r1.node.notChecked);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngIf", !ctx_r1.node.notChecked && !ctx_r1.node.checking);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngIf", ctx_r1.node.canBeStarted);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngIf", ctx_r1.node.isRunning || ctx_r1.node.isStarting);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngIf", ctx_r1.node.isRunning);
} }
function NodeDetailsComponent_section_0_span_8_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "span");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
} if (rf & 2) {
    const ctx_r2 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtextInterpolate1"]("Service status: ", ctx_r2.node.status, "");
} }
function NodeDetailsComponent_section_0_span_9_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "span");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
} if (rf & 2) {
    const ctx_r3 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtextInterpolate1"]("Allocated port: ", ctx_r3.node.port, "");
} }
function NodeDetailsComponent_section_0_span_10_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "span");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
} if (rf & 2) {
    const ctx_r4 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtextInterpolate1"]("Transpiling status: ", ctx_r4.node.transpiled, "");
} }
function NodeDetailsComponent_section_0_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "section");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](1, "div", 1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](2, "h2");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](3);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](4, "span");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](5);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](6, NodeDetailsComponent_section_0_div_6_Template, 10, 7, "div", 2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](7, "div", 3);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](8, NodeDetailsComponent_section_0_span_8_Template, 2, 1, "span", 0);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](9, NodeDetailsComponent_section_0_span_9_Template, 2, 1, "span", 0);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](10, NodeDetailsComponent_section_0_span_10_Template, 2, 1, "span", 0);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](11, "span");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](12);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](13, "span");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](14);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelement"](15, "div", 4);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
} if (rf & 2) {
    const ctx_r0 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](3);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtextInterpolate"](ctx_r0.node.name);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtextInterpolate"](ctx_r0.node.version);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngIf", !ctx_r0.node.disabled);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngIf", ctx_r0.node.isService);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngIf", ctx_r0.node.isService);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngIf", !ctx_r0.node.isService);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtextInterpolate1"]("Type-checking status: ", ctx_r0.node.typeChecked, "");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtextInterpolate1"]("Last type-checking: ", ctx_r0.node.lastTypeCheck, "");
} }
class NodeDetailsComponent {
    constructor(tabs, mila) {
        this.tabs = tabs;
        this.mila = mila;
        this.fa = {
            refresh: _fortawesome_free_solid_svg_icons__WEBPACK_IMPORTED_MODULE_1__["faRedo"],
            build: _fortawesome_free_solid_svg_icons__WEBPACK_IMPORTED_MODULE_1__["faHammer"],
            start: _fortawesome_free_solid_svg_icons__WEBPACK_IMPORTED_MODULE_1__["faPlay"],
            stop: _fortawesome_free_solid_svg_icons__WEBPACK_IMPORTED_MODULE_1__["faStop"],
            logs: _fortawesome_free_solid_svg_icons__WEBPACK_IMPORTED_MODULE_1__["faFileAlt"],
            tsc: _fortawesome_free_solid_svg_icons__WEBPACK_IMPORTED_MODULE_1__["faClipboard"],
        };
    }
    ngOnInit() {
        // FIXME: take until
        this.tabs.currentTab$.subscribe((tab) => {
            this.node = this.mila.getNode(tab.name);
        });
    }
    openLogs() {
        this.mila.selectService(this.node.name);
        this.tabs.openTab('service-logs', `Logs | ${this.node.name}`);
    }
    openTscLogs() {
        this.mila.setCurrentNode(this.node.name);
        this.tabs.openTab('tsc-logs', `${this.node.name} | tsc`);
    }
}
NodeDetailsComponent.ɵfac = function NodeDetailsComponent_Factory(t) { return new (t || NodeDetailsComponent)(_angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵdirectiveInject"](_tabs_service__WEBPACK_IMPORTED_MODULE_2__["TabsService"]), _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵdirectiveInject"](_mila_service__WEBPACK_IMPORTED_MODULE_3__["MilaService"])); };
NodeDetailsComponent.ɵcmp = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵdefineComponent"]({ type: NodeDetailsComponent, selectors: [["app-node-details"]], decls: 1, vars: 1, consts: [[4, "ngIf"], [1, "title"], ["class", "actions", 4, "ngIf"], [1, "general-infos"], [1, "metrics"], [1, "actions"], [1, "btn", "btn-blue", 3, "click"], [3, "icon"], ["class", "btn btn-blue", 3, "click", 4, "ngIf"], ["class", "btn btn-red", 3, "click", 4, "ngIf"], [1, "btn", "btn-red", 3, "click"]], template: function NodeDetailsComponent_Template(rf, ctx) { if (rf & 1) {
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](0, NodeDetailsComponent_section_0_Template, 16, 8, "section", 0);
    } if (rf & 2) {
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngIf", ctx.node);
    } }, directives: [_angular_common__WEBPACK_IMPORTED_MODULE_4__["NgIf"], _fortawesome_angular_fontawesome__WEBPACK_IMPORTED_MODULE_5__["FaIconComponent"]], styles: ["section[_ngcontent-%COMP%] {\n  padding: 10px;\n}\nsection[_ngcontent-%COMP%]    > div[_ngcontent-%COMP%] {\n  margin: 20px 0;\n}\nsection[_ngcontent-%COMP%]   .btn[_ngcontent-%COMP%] {\n  margin: 0 2px;\n}\nsection[_ngcontent-%COMP%]   .title[_ngcontent-%COMP%] {\n  margin-bottom: 20px;\n}\nsection[_ngcontent-%COMP%]   .title[_ngcontent-%COMP%]   h2[_ngcontent-%COMP%] {\n  margin-bottom: 5px;\n}\nsection[_ngcontent-%COMP%]   .general-infos[_ngcontent-%COMP%] {\n  display: flex;\n  flex-direction: column;\n}\n/*# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInNyYy9hcHAvbm9kZS1kZXRhaWxzL25vZGUtZGV0YWlscy5jb21wb25lbnQuc2NzcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtFQUNFLGFBQUE7QUFDRjtBQUFFO0VBQ0UsY0FBQTtBQUVKO0FBQUU7RUFDRSxhQUFBO0FBRUo7QUFBRTtFQUlFLG1CQUFBO0FBREo7QUFGSTtFQUNFLGtCQUFBO0FBSU47QUFBRTtFQUNFLGFBQUE7RUFDQSxzQkFBQTtBQUVKIiwiZmlsZSI6InNyYy9hcHAvbm9kZS1kZXRhaWxzL25vZGUtZGV0YWlscy5jb21wb25lbnQuc2NzcyIsInNvdXJjZXNDb250ZW50IjpbInNlY3Rpb24ge1xuICBwYWRkaW5nOiAxMHB4O1xuICAmID4gZGl2IHtcbiAgICBtYXJnaW46IDIwcHggMDtcbiAgfVxuICAuYnRuIHtcbiAgICBtYXJnaW46IDAgMnB4O1xuICB9XG4gIC50aXRsZSB7XG4gICAgaDIge1xuICAgICAgbWFyZ2luLWJvdHRvbTogNXB4O1xuICAgIH1cbiAgICBtYXJnaW4tYm90dG9tOiAyMHB4O1xuICB9XG4gIC5nZW5lcmFsLWluZm9zIHtcbiAgICBkaXNwbGF5OiBmbGV4O1xuICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gIH1cblxufVxuIl19 */"] });
/*@__PURE__*/ (function () { _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵsetClassMetadata"](NodeDetailsComponent, [{
        type: _angular_core__WEBPACK_IMPORTED_MODULE_0__["Component"],
        args: [{
                selector: 'app-node-details',
                templateUrl: './node-details.component.html',
                styleUrls: ['./node-details.component.scss']
            }]
    }], function () { return [{ type: _tabs_service__WEBPACK_IMPORTED_MODULE_2__["TabsService"] }, { type: _mila_service__WEBPACK_IMPORTED_MODULE_3__["MilaService"] }]; }, null); })();


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
    get isRunning() {
        return this._status === _service_status_enum__WEBPACK_IMPORTED_MODULE_1__["ServiceStatus"].RUNNING;
    }
    get isStarting() {
        return this._status === _service_status_enum__WEBPACK_IMPORTED_MODULE_1__["ServiceStatus"].STARTING;
    }
    get isService() {
        return true;
    }
    get canBeStarted() {
        return this._status === _service_status_enum__WEBPACK_IMPORTED_MODULE_1__["ServiceStatus"].STOPPED || this._status === _service_status_enum__WEBPACK_IMPORTED_MODULE_1__["ServiceStatus"].CRASHED;
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
/* harmony import */ var _fortawesome_free_solid_svg_icons__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @fortawesome/free-solid-svg-icons */ "wHSu");
/* harmony import */ var _mila_service__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./mila.service */ "Bhgz");
/* harmony import */ var _tabs_service__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./tabs.service */ "2UJW");
/* harmony import */ var _angular_common__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @angular/common */ "ofXK");
/* harmony import */ var _3dgenomes_ngx_resizable__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @3dgenomes/ngx-resizable */ "ZySY");
/* harmony import */ var _nodes_list_nodes_list_component__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./nodes-list/nodes-list.component */ "lPRk");
/* harmony import */ var _fortawesome_angular_fontawesome__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @fortawesome/angular-fontawesome */ "6NWb");
/* harmony import */ var _events_log_events_log_component__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./events-log/events-log.component */ "h9jK");
/* harmony import */ var _node_details_node_details_component__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./node-details/node-details.component */ "DYO7");
/* harmony import */ var _service_logs_service_logs_component__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./service-logs/service-logs.component */ "vSZq");
/* harmony import */ var _tsc_logs_tsc_logs_component__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ./tsc-logs/tsc-logs.component */ "5tzZ");













function AppComponent_p_7_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "p");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](1, "Waiting for mila server");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
} }
function AppComponent_rsz_layout_9_li_14_span_3_Template(rf, ctx) { if (rf & 1) {
    const _r12 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵgetCurrentView"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "span", 14);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵlistener"]("click", function AppComponent_rsz_layout_9_li_14_span_3_Template_span_click_0_listener() { _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵrestoreView"](_r12); const tab_r8 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"]().$implicit; const ctx_r10 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"](2); return ctx_r10.tabs.deleteTab(tab_r8.name); });
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelement"](1, "fa-icon", 15);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
} if (rf & 2) {
    const ctx_r9 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"](3);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("icon", ctx_r9.faTimes);
} }
const _c0 = function (a0) { return { active: a0 }; };
function AppComponent_rsz_layout_9_li_14_Template(rf, ctx) { if (rf & 1) {
    const _r14 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵgetCurrentView"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "li", 6);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵlistener"]("click", function AppComponent_rsz_layout_9_li_14_Template_li_click_0_listener() { _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵrestoreView"](_r14); const tab_r8 = ctx.$implicit; const ctx_r13 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"](2); return ctx_r13.tabs.selectTab(tab_r8); });
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵpipe"](1, "async");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](3, AppComponent_rsz_layout_9_li_14_span_3_Template, 2, 1, "span", 13);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
} if (rf & 2) {
    const tab_r8 = ctx.$implicit;
    const ctx_r2 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngClass", _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵpureFunction1"](5, _c0, tab_r8 === _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵpipeBind1"](1, 3, ctx_r2.tabs.currentTab$)));
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtextInterpolate1"](" ", tab_r8.name, " ");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngIf", tab_r8.closable);
} }
function AppComponent_rsz_layout_9_app_events_log_18_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelement"](0, "app-events-log");
} }
function AppComponent_rsz_layout_9_app_node_details_19_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelement"](0, "app-node-details");
} }
function AppComponent_rsz_layout_9_app_service_logs_20_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelement"](0, "app-service-logs");
} }
function AppComponent_rsz_layout_9_app_tsc_logs_21_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelement"](0, "app-tsc-logs");
} }
function AppComponent_rsz_layout_9_p_22_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "p");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](1, "Unknown tab type");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
} }
const _c1 = function () { return ["right"]; };
const _c2 = function () { return ["none"]; };
function AppComponent_rsz_layout_9_Template(rf, ctx) { if (rf & 1) {
    const _r16 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵgetCurrentView"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "rsz-layout", 3);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](1, "rsz-layout", 4);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](2, "nav", 5);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](3, "ul");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](4, "li", 6);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵlistener"]("click", function AppComponent_rsz_layout_9_Template_li_click_4_listener() { _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵrestoreView"](_r16); const ctx_r15 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"](); return ctx_r15.nodeList = "packages"; });
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](5, "Packages");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](6, "li", 6);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵlistener"]("click", function AppComponent_rsz_layout_9_Template_li_click_6_listener() { _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵrestoreView"](_r16); const ctx_r17 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"](); return ctx_r17.nodeList = "services"; });
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](7, "Services");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](8, "li", 6);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵlistener"]("click", function AppComponent_rsz_layout_9_Template_li_click_8_listener() { _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵrestoreView"](_r16); const ctx_r18 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"](); return ctx_r18.nodeList = null; });
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](9, "All");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelement"](10, "app-nodes-list", 7);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](11, "rsz-layout", 8);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](12, "nav", 5);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](13, "ul");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](14, AppComponent_rsz_layout_9_li_14_Template, 4, 7, "li", 9);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵpipe"](15, "async");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementContainerStart"](16, 10);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵpipe"](17, "async");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](18, AppComponent_rsz_layout_9_app_events_log_18_Template, 1, 0, "app-events-log", 11);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](19, AppComponent_rsz_layout_9_app_node_details_19_Template, 1, 0, "app-node-details", 11);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](20, AppComponent_rsz_layout_9_app_service_logs_20_Template, 1, 0, "app-service-logs", 11);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](21, AppComponent_rsz_layout_9_app_tsc_logs_21_Template, 1, 0, "app-tsc-logs", 11);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](22, AppComponent_rsz_layout_9_p_22_Template, 2, 0, "p", 12);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementContainerEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
} if (rf & 2) {
    const ctx_r1 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("rFlex", true);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("directions", _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵpureFunction0"](19, _c1))("rFlex", true);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](3);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngClass", _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵpureFunction1"](20, _c0, ctx_r1.nodeList === "packages"));
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngClass", _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵpureFunction1"](22, _c0, ctx_r1.nodeList === "services"));
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngClass", _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵpureFunction1"](24, _c0, ctx_r1.nodeList == null));
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("filter", ctx_r1.nodeList);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("directions", _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵpureFunction0"](26, _c2))("rFlex", false);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](3);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngForOf", _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵpipeBind1"](15, 15, ctx_r1.tabs.tabs$));
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngSwitch", _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵpipeBind1"](17, 17, ctx_r1.tabs.currentTab$).type);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngSwitchCase", "events-log");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngSwitchCase", "node-details");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngSwitchCase", "service-logs");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngSwitchCase", "tsc-logs");
} }
class AppComponent {
    constructor(mila, tabs) {
        this.mila = mila;
        this.tabs = tabs;
        this.title = 'client';
        this.faTimes = _fortawesome_free_solid_svg_icons__WEBPACK_IMPORTED_MODULE_1__["faTimes"];
    }
}
AppComponent.ɵfac = function AppComponent_Factory(t) { return new (t || AppComponent)(_angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵdirectiveInject"](_mila_service__WEBPACK_IMPORTED_MODULE_2__["MilaService"]), _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵdirectiveInject"](_tabs_service__WEBPACK_IMPORTED_MODULE_3__["TabsService"])); };
AppComponent.ɵcmp = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵdefineComponent"]({ type: AppComponent, selectors: [["app-root"]], decls: 11, vars: 6, consts: [["href", "https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@300;400;600;700&display=swap", "rel", "stylesheet"], [4, "ngIf"], ["class", "row main-content", 3, "rFlex", 4, "ngIf"], [1, "row", "main-content", 3, "rFlex"], [1, "cell", "services", 3, "directions", "rFlex"], [1, "tab-header"], [3, "ngClass", "click"], [3, "filter"], [1, "cell", "logs", 3, "directions", "rFlex"], [3, "ngClass", "click", 4, "ngFor", "ngForOf"], [3, "ngSwitch"], [4, "ngSwitchCase"], [4, "ngSwitchDefault"], ["class", "close-tab", 3, "click", 4, "ngIf"], [1, "close-tab", 3, "click"], [3, "icon"]], template: function AppComponent_Template(rf, ctx) { if (rf & 1) {
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "html");
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](1, "head");
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelement"](2, "link", 0);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](3, "body");
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](4, "header");
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](5, "h1");
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](6, "Micro\u03BBambda");
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](7, AppComponent_p_7_Template, 2, 0, "p", 1);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵpipe"](8, "async");
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](9, AppComponent_rsz_layout_9_Template, 23, 27, "rsz-layout", 2);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵpipe"](10, "async");
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    } if (rf & 2) {
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](7);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngIf", _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵpipeBind1"](8, 2, ctx.mila.connected$) === false);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](2);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngIf", _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵpipeBind1"](10, 4, ctx.mila.connected$) === true);
    } }, directives: [_angular_common__WEBPACK_IMPORTED_MODULE_4__["NgIf"], _3dgenomes_ngx_resizable__WEBPACK_IMPORTED_MODULE_5__["ResizableComponent"], _angular_common__WEBPACK_IMPORTED_MODULE_4__["NgClass"], _nodes_list_nodes_list_component__WEBPACK_IMPORTED_MODULE_6__["NodesListComponent"], _angular_common__WEBPACK_IMPORTED_MODULE_4__["NgForOf"], _angular_common__WEBPACK_IMPORTED_MODULE_4__["NgSwitch"], _angular_common__WEBPACK_IMPORTED_MODULE_4__["NgSwitchCase"], _angular_common__WEBPACK_IMPORTED_MODULE_4__["NgSwitchDefault"], _fortawesome_angular_fontawesome__WEBPACK_IMPORTED_MODULE_7__["FaIconComponent"], _events_log_events_log_component__WEBPACK_IMPORTED_MODULE_8__["EventsLogComponent"], _node_details_node_details_component__WEBPACK_IMPORTED_MODULE_9__["NodeDetailsComponent"], _service_logs_service_logs_component__WEBPACK_IMPORTED_MODULE_10__["ServiceLogsComponent"], _tsc_logs_tsc_logs_component__WEBPACK_IMPORTED_MODULE_11__["TscLogsComponent"]], pipes: [_angular_common__WEBPACK_IMPORTED_MODULE_4__["AsyncPipe"]], styles: ["header[_ngcontent-%COMP%] {\n  height: 64px;\n  display: flex;\n  flex-direction: row;\n  justify-content: flex-start;\n  align-items: center;\n}\nheader[_ngcontent-%COMP%]   h1[_ngcontent-%COMP%] {\n  margin: 0 10px;\n}\n.main-content[_ngcontent-%COMP%] {\n  height: calc(100vh - 80px);\n}\n.cell[_ngcontent-%COMP%] {\n  background-color: transparent;\n  border: none;\n  border-top: 4px solid #454545;\n}\n.cell.services[_ngcontent-%COMP%] {\n  border-right: 4px solid #454545;\n}\nnav.tab-header[_ngcontent-%COMP%] {\n  background-color: #323232;\n  height: 20px;\n  font-size: 10pt;\n  margin: 0;\n}\nnav.tab-header[_ngcontent-%COMP%]   ul[_ngcontent-%COMP%] {\n  margin: 0;\n  padding: 0;\n  display: flex;\n  flex-direction: row;\n  align-items: center;\n  justify-content: flex-start;\n}\nnav.tab-header[_ngcontent-%COMP%]   ul[_ngcontent-%COMP%]   li[_ngcontent-%COMP%] {\n  cursor: pointer;\n  padding: 0 10px;\n  margin: 0;\n  height: 20px;\n  line-height: 20px;\n  vertical-align: middle;\n  border-right: 1px solid #616161;\n  flex-wrap: nowrap;\n  flex-direction: row;\n  white-space: nowrap;\n  align-items: center;\n}\nnav.tab-header[_ngcontent-%COMP%]   ul[_ngcontent-%COMP%]   li[_ngcontent-%COMP%]   .close-tab[_ngcontent-%COMP%] {\n  margin-left: 5px;\n}\nnav.tab-header[_ngcontent-%COMP%]   ul[_ngcontent-%COMP%]   li[_ngcontent-%COMP%]:hover {\n  background-color: #616161;\n}\nnav.tab-header[_ngcontent-%COMP%]   ul[_ngcontent-%COMP%]   li.active[_ngcontent-%COMP%] {\n  background-color: #616161;\n}\n/*# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInNyYy9hcHAvYXBwLmNvbXBvbmVudC5zY3NzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0VBQ0UsWUFBQTtFQUNBLGFBQUE7RUFDQSxtQkFBQTtFQUNBLDJCQUFBO0VBQ0EsbUJBQUE7QUFDRjtBQUFFO0VBQ0UsY0FBQTtBQUVKO0FBRUE7RUFDRSwwQkFBQTtBQUNGO0FBRUE7RUFDRSw2QkFBQTtFQUNBLFlBQUE7RUFDQSw2QkFBQTtBQUNGO0FBQUU7RUFDRSwrQkFBQTtBQUVKO0FBRUE7RUFDRSx5QkFBQTtFQUNBLFlBQUE7RUFDQSxlQUFBO0VBQ0EsU0FBQTtBQUNGO0FBQUU7RUFDRSxTQUFBO0VBQ0EsVUFBQTtFQUNBLGFBQUE7RUFDQSxtQkFBQTtFQUNBLG1CQUFBO0VBQ0EsMkJBQUE7QUFFSjtBQURJO0VBQ0UsZUFBQTtFQUNBLGVBQUE7RUFDQSxTQUFBO0VBQ0EsWUFBQTtFQUNBLGlCQUFBO0VBQ0Esc0JBQUE7RUFDQSwrQkFBQTtFQUNBLGlCQUFBO0VBQ0EsbUJBQUE7RUFDQSxtQkFBQTtFQUNBLG1CQUFBO0FBR047QUFGTTtFQUNFLGdCQUFBO0FBSVI7QUFESTtFQUNFLHlCQUFBO0FBR047QUFESTtFQUNFLHlCQUFBO0FBR04iLCJmaWxlIjoic3JjL2FwcC9hcHAuY29tcG9uZW50LnNjc3MiLCJzb3VyY2VzQ29udGVudCI6WyJoZWFkZXIge1xuICBoZWlnaHQ6IDY0cHg7XG4gIGRpc3BsYXk6IGZsZXg7XG4gIGZsZXgtZGlyZWN0aW9uOiByb3c7XG4gIGp1c3RpZnktY29udGVudDogZmxleC1zdGFydDtcbiAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgaDEge1xuICAgIG1hcmdpbjogMCAxMHB4O1xuICB9XG59XG5cbi5tYWluLWNvbnRlbnQge1xuICBoZWlnaHQ6IGNhbGMoMTAwdmggLSA4MHB4KTtcbn1cblxuLmNlbGwge1xuICBiYWNrZ3JvdW5kLWNvbG9yOiB0cmFuc3BhcmVudDtcbiAgYm9yZGVyOiBub25lO1xuICBib3JkZXItdG9wOiA0cHggc29saWQgIzQ1NDU0NTtcbiAgJi5zZXJ2aWNlcyB7XG4gICAgYm9yZGVyLXJpZ2h0OiA0cHggc29saWQgIzQ1NDU0NTtcbiAgfVxufVxuXG5uYXYudGFiLWhlYWRlciB7XG4gIGJhY2tncm91bmQtY29sb3I6ICMzMjMyMzI7XG4gIGhlaWdodDogMjBweDtcbiAgZm9udC1zaXplOiAxMHB0O1xuICBtYXJnaW46IDA7XG4gIHVsIHtcbiAgICBtYXJnaW46IDA7XG4gICAgcGFkZGluZzogMDtcbiAgICBkaXNwbGF5OiBmbGV4O1xuICAgIGZsZXgtZGlyZWN0aW9uOiByb3c7XG4gICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICBqdXN0aWZ5LWNvbnRlbnQ6IGZsZXgtc3RhcnQ7XG4gICAgbGkge1xuICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgcGFkZGluZzogMCAxMHB4O1xuICAgICAgbWFyZ2luOiAwO1xuICAgICAgaGVpZ2h0OiAyMHB4O1xuICAgICAgbGluZS1oZWlnaHQ6IDIwcHg7XG4gICAgICB2ZXJ0aWNhbC1hbGlnbjogbWlkZGxlO1xuICAgICAgYm9yZGVyLXJpZ2h0OiAxcHggc29saWQgIzYxNjE2MTtcbiAgICAgIGZsZXgtd3JhcDogbm93cmFwO1xuICAgICAgZmxleC1kaXJlY3Rpb246IHJvdztcbiAgICAgIHdoaXRlLXNwYWNlOiBub3dyYXA7XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgLmNsb3NlLXRhYiB7XG4gICAgICAgIG1hcmdpbi1sZWZ0OiA1cHg7XG4gICAgICB9XG4gICAgfVxuICAgIGxpOmhvdmVyIHtcbiAgICAgIGJhY2tncm91bmQtY29sb3I6ICM2MTYxNjE7XG4gICAgfVxuICAgIGxpLmFjdGl2ZSB7XG4gICAgICBiYWNrZ3JvdW5kLWNvbG9yOiAjNjE2MTYxO1xuICAgIH1cbiAgfVxufVxuIl19 */"] });
/*@__PURE__*/ (function () { _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵsetClassMetadata"](AppComponent, [{
        type: _angular_core__WEBPACK_IMPORTED_MODULE_0__["Component"],
        args: [{
                selector: 'app-root',
                templateUrl: './app.component.html',
                styleUrls: ['./app.component.scss']
            }]
    }], function () { return [{ type: _mila_service__WEBPACK_IMPORTED_MODULE_2__["MilaService"] }, { type: _tabs_service__WEBPACK_IMPORTED_MODULE_3__["TabsService"] }]; }, null); })();


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
/* harmony import */ var _node_details_node_details_component__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./node-details/node-details.component */ "DYO7");
/* harmony import */ var _fortawesome_angular_fontawesome__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @fortawesome/angular-fontawesome */ "6NWb");
/* harmony import */ var _service_logs_service_logs_component__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./service-logs/service-logs.component */ "vSZq");
/* harmony import */ var _safe_html_pipe__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./safe-html.pipe */ "ZJwn");
/* harmony import */ var _tsc_logs_tsc_logs_component__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ./tsc-logs/tsc-logs.component */ "5tzZ");
/* harmony import */ var ngx_infinite_scroll__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ngx-infinite-scroll */ "dlKe");














class AppModule {
}
AppModule.ɵmod = _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵdefineNgModule"]({ type: AppModule, bootstrap: [_app_component__WEBPACK_IMPORTED_MODULE_2__["AppComponent"]] });
AppModule.ɵinj = _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵdefineInjector"]({ factory: function AppModule_Factory(t) { return new (t || AppModule)(); }, providers: [], imports: [[
            _angular_platform_browser__WEBPACK_IMPORTED_MODULE_0__["BrowserModule"],
            _angular_common_http__WEBPACK_IMPORTED_MODULE_5__["HttpClientModule"],
            _3dgenomes_ngx_resizable__WEBPACK_IMPORTED_MODULE_6__["NgxResizableModule"],
            _fortawesome_angular_fontawesome__WEBPACK_IMPORTED_MODULE_8__["FontAwesomeModule"],
            ngx_infinite_scroll__WEBPACK_IMPORTED_MODULE_12__["InfiniteScrollModule"],
        ]] });
(function () { (typeof ngJitMode === "undefined" || ngJitMode) && _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵsetNgModuleScope"](AppModule, { declarations: [_app_component__WEBPACK_IMPORTED_MODULE_2__["AppComponent"],
        _nodes_list_nodes_list_component__WEBPACK_IMPORTED_MODULE_3__["NodesListComponent"],
        _events_log_events_log_component__WEBPACK_IMPORTED_MODULE_4__["EventsLogComponent"],
        _node_details_node_details_component__WEBPACK_IMPORTED_MODULE_7__["NodeDetailsComponent"],
        _service_logs_service_logs_component__WEBPACK_IMPORTED_MODULE_9__["ServiceLogsComponent"],
        _safe_html_pipe__WEBPACK_IMPORTED_MODULE_10__["SafeHtmlPipe"],
        _tsc_logs_tsc_logs_component__WEBPACK_IMPORTED_MODULE_11__["TscLogsComponent"]], imports: [_angular_platform_browser__WEBPACK_IMPORTED_MODULE_0__["BrowserModule"],
        _angular_common_http__WEBPACK_IMPORTED_MODULE_5__["HttpClientModule"],
        _3dgenomes_ngx_resizable__WEBPACK_IMPORTED_MODULE_6__["NgxResizableModule"],
        _fortawesome_angular_fontawesome__WEBPACK_IMPORTED_MODULE_8__["FontAwesomeModule"],
        ngx_infinite_scroll__WEBPACK_IMPORTED_MODULE_12__["InfiniteScrollModule"]] }); })();
/*@__PURE__*/ (function () { _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵsetClassMetadata"](AppModule, [{
        type: _angular_core__WEBPACK_IMPORTED_MODULE_1__["NgModule"],
        args: [{
                declarations: [
                    _app_component__WEBPACK_IMPORTED_MODULE_2__["AppComponent"],
                    _nodes_list_nodes_list_component__WEBPACK_IMPORTED_MODULE_3__["NodesListComponent"],
                    _events_log_events_log_component__WEBPACK_IMPORTED_MODULE_4__["EventsLogComponent"],
                    _node_details_node_details_component__WEBPACK_IMPORTED_MODULE_7__["NodeDetailsComponent"],
                    _service_logs_service_logs_component__WEBPACK_IMPORTED_MODULE_9__["ServiceLogsComponent"],
                    _safe_html_pipe__WEBPACK_IMPORTED_MODULE_10__["SafeHtmlPipe"],
                    _tsc_logs_tsc_logs_component__WEBPACK_IMPORTED_MODULE_11__["TscLogsComponent"],
                ],
                imports: [
                    _angular_platform_browser__WEBPACK_IMPORTED_MODULE_0__["BrowserModule"],
                    _angular_common_http__WEBPACK_IMPORTED_MODULE_5__["HttpClientModule"],
                    _3dgenomes_ngx_resizable__WEBPACK_IMPORTED_MODULE_6__["NgxResizableModule"],
                    _fortawesome_angular_fontawesome__WEBPACK_IMPORTED_MODULE_8__["FontAwesomeModule"],
                    ngx_infinite_scroll__WEBPACK_IMPORTED_MODULE_12__["InfiniteScrollModule"],
                ],
                providers: [],
                bootstrap: [_app_component__WEBPACK_IMPORTED_MODULE_2__["AppComponent"]]
            }]
    }], null, null); })();


/***/ }),

/***/ "ZJwn":
/*!***********************************!*\
  !*** ./src/app/safe-html.pipe.ts ***!
  \***********************************/
/*! exports provided: SafeHtmlPipe */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "SafeHtmlPipe", function() { return SafeHtmlPipe; });
/* harmony import */ var _angular_core__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @angular/core */ "fXoL");
/* harmony import */ var _angular_platform_browser__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @angular/platform-browser */ "jhN1");



class SafeHtmlPipe {
    constructor(sanitized) {
        this.sanitized = sanitized;
    }
    transform(value) {
        return this.sanitized.bypassSecurityTrustHtml(value);
    }
}
SafeHtmlPipe.ɵfac = function SafeHtmlPipe_Factory(t) { return new (t || SafeHtmlPipe)(_angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵdirectiveInject"](_angular_platform_browser__WEBPACK_IMPORTED_MODULE_1__["DomSanitizer"])); };
SafeHtmlPipe.ɵpipe = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵdefinePipe"]({ name: "safeHtml", type: SafeHtmlPipe, pure: true });
/*@__PURE__*/ (function () { _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵsetClassMetadata"](SafeHtmlPipe, [{
        type: _angular_core__WEBPACK_IMPORTED_MODULE_0__["Pipe"],
        args: [{ name: 'safeHtml' }]
    }], function () { return [{ type: _angular_platform_browser__WEBPACK_IMPORTED_MODULE_1__["DomSanitizer"] }]; }, null); })();


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
/* harmony import */ var _fortawesome_free_solid_svg_icons__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @fortawesome/free-solid-svg-icons */ "wHSu");
/* harmony import */ var _mila_service__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../mila.service */ "Bhgz");
/* harmony import */ var _fortawesome_angular_fontawesome__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @fortawesome/angular-fontawesome */ "6NWb");
/* harmony import */ var _angular_common__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @angular/common */ "ofXK");
/* harmony import */ var ngx_infinite_scroll__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ngx-infinite-scroll */ "dlKe");
/* harmony import */ var _safe_html_pipe__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ../safe-html.pipe */ "ZJwn");








function EventsLogComponent_div_10_fa_icon_6_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelement"](0, "fa-icon", 15);
} if (rf & 2) {
    const ctx_r2 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("icon", ctx_r2.faCheck);
} }
function EventsLogComponent_div_10_fa_icon_11_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelement"](0, "fa-icon", 15);
} if (rf & 2) {
    const ctx_r3 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("icon", ctx_r3.faCheck);
} }
function EventsLogComponent_div_10_fa_icon_16_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelement"](0, "fa-icon", 15);
} if (rf & 2) {
    const ctx_r4 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("icon", ctx_r4.faCheck);
} }
function EventsLogComponent_div_10_fa_icon_21_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelement"](0, "fa-icon", 15);
} if (rf & 2) {
    const ctx_r5 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("icon", ctx_r5.faCheck);
} }
function EventsLogComponent_div_10_fa_icon_26_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelement"](0, "fa-icon", 15);
} if (rf & 2) {
    const ctx_r6 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("icon", ctx_r6.faCheck);
} }
function EventsLogComponent_div_10_Template(rf, ctx) { if (rf & 1) {
    const _r8 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵgetCurrentView"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "div", 7);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](1, "ul");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](2, "li", 8);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵlistener"]("click", function EventsLogComponent_div_10_Template_li_click_2_listener() { _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵrestoreView"](_r8); const ctx_r7 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"](); return ctx_r7.toggleLevel("silly"); });
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](3, "span");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelement"](4, "fa-icon", 9);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](5, "Silly");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](6, EventsLogComponent_div_10_fa_icon_6_Template, 1, 1, "fa-icon", 10);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](7, "li", 8);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵlistener"]("click", function EventsLogComponent_div_10_Template_li_click_7_listener() { _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵrestoreView"](_r8); const ctx_r9 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"](); return ctx_r9.toggleLevel("debug"); });
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](8, "span");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelement"](9, "fa-icon", 11);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](10, "Debug");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](11, EventsLogComponent_div_10_fa_icon_11_Template, 1, 1, "fa-icon", 10);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](12, "li", 8);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵlistener"]("click", function EventsLogComponent_div_10_Template_li_click_12_listener() { _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵrestoreView"](_r8); const ctx_r10 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"](); return ctx_r10.toggleLevel("info"); });
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](13, "span");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelement"](14, "fa-icon", 12);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](15, "Info");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](16, EventsLogComponent_div_10_fa_icon_16_Template, 1, 1, "fa-icon", 10);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](17, "li", 8);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵlistener"]("click", function EventsLogComponent_div_10_Template_li_click_17_listener() { _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵrestoreView"](_r8); const ctx_r11 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"](); return ctx_r11.toggleLevel("warn"); });
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](18, "span");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelement"](19, "fa-icon", 13);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](20, "Warn");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](21, EventsLogComponent_div_10_fa_icon_21_Template, 1, 1, "fa-icon", 10);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](22, "li", 8);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵlistener"]("click", function EventsLogComponent_div_10_Template_li_click_22_listener() { _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵrestoreView"](_r8); const ctx_r12 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"](); return ctx_r12.toggleLevel("error"); });
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](23, "span");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelement"](24, "fa-icon", 14);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](25, "Error");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](26, EventsLogComponent_div_10_fa_icon_26_Template, 1, 1, "fa-icon", 10);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
} if (rf & 2) {
    const ctx_r0 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](4);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("icon", ctx_r0.faSilly);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngIf", ctx_r0.levels.includes("silly"));
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](3);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("icon", ctx_r0.faBug);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngIf", ctx_r0.levels.includes("debug"));
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](3);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("icon", ctx_r0.faInfo);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngIf", ctx_r0.levels.includes("info"));
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](3);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("icon", ctx_r0.faAlert);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngIf", ctx_r0.levels.includes("warn"));
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](3);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("icon", ctx_r0.faCross);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngIf", ctx_r0.levels.includes("error"));
} }
function EventsLogComponent_li_12_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "li");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](1, "span", 16);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](3, "span", 17);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](4);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](5, "span", 18);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](6);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelement"](7, "span", 19);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵpipe"](8, "safeHtml");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
} if (rf & 2) {
    const log_r13 = ctx.$implicit;
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngClass", log_r13.class);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtextInterpolate1"]("[", log_r13.level, "]");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtextInterpolate"](log_r13.date);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtextInterpolate1"]("(", log_r13.scope, ")");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("innerHTML", _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵpipeBind1"](8, 5, log_r13.args), _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵsanitizeHtml"]);
} }
class EventsLogComponent {
    constructor(mila) {
        this.mila = mila;
        this.levels = ['info', 'warn', 'error'];
        this.faFilter = _fortawesome_free_solid_svg_icons__WEBPACK_IMPORTED_MODULE_1__["faFilter"];
        this.faCheck = _fortawesome_free_solid_svg_icons__WEBPACK_IMPORTED_MODULE_1__["faCheck"];
        this.faBug = _fortawesome_free_solid_svg_icons__WEBPACK_IMPORTED_MODULE_1__["faBug"];
        this.faInfo = _fortawesome_free_solid_svg_icons__WEBPACK_IMPORTED_MODULE_1__["faInfo"];
        this.faCross = _fortawesome_free_solid_svg_icons__WEBPACK_IMPORTED_MODULE_1__["faTimes"];
        this.faAlert = _fortawesome_free_solid_svg_icons__WEBPACK_IMPORTED_MODULE_1__["faExclamation"];
        this.faSilly = _fortawesome_free_solid_svg_icons__WEBPACK_IMPORTED_MODULE_1__["faBong"];
        this.faChevron = _fortawesome_free_solid_svg_icons__WEBPACK_IMPORTED_MODULE_1__["faChevronDown"];
        this.showOptions = false;
        this._logs = [];
    }
    ngOnInit() {
        // FIXME: take until
        this.mila.log$.subscribe((logs) => {
            this._logs = logs;
            console.debug('Received logs', logs.length);
            this.filterLogs();
            this._scrollToEnd();
        });
        this.mila.getLogs();
    }
    // TODO: Search
    filterLogs() {
        // FIXME: Perf issue, too much logs
        this.logs = this._logs.filter(l => this.levels.includes(l.level));
        console.debug('Filtered logs', this.logs.length);
    }
    _scrollToEnd() {
        console.log('scrolling');
        setTimeout(() => {
            const elt = document.getElementById('events-log');
            if (elt) {
                elt.scrollTo({ behavior: 'smooth', top: elt.scrollHeight - elt.clientHeight });
            }
        }, 0);
    }
    toggleLevel(level) {
        if (this.levels.includes(level)) {
            this.levels = this.levels.filter(l => l !== level);
        }
        else {
            this.levels.push(level);
        }
        // Refresh list
        this.filterLogs();
        setTimeout(() => this.showOptions = false, 100);
    }
    onScrollUp() {
        console.log('yolo');
    }
}
EventsLogComponent.ɵfac = function EventsLogComponent_Factory(t) { return new (t || EventsLogComponent)(_angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵdirectiveInject"](_mila_service__WEBPACK_IMPORTED_MODULE_2__["MilaService"])); };
EventsLogComponent.ɵcmp = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵdefineComponent"]({ type: EventsLogComponent, selectors: [["app-events-log"]], decls: 13, vars: 6, consts: [[1, "heading"], [1, "filters"], [1, "trigger", 3, "click"], [3, "icon"], ["class", "options", 4, "ngIf"], ["id", "events-log", "infiniteScroll", "", 1, "mono", 3, "infiniteScrollUpDistance", "infiniteScrollThrottle", "scrolledUp"], [4, "ngFor", "ngForOf"], [1, "options"], [3, "click"], [1, "silly", 3, "icon"], ["class", "check", 3, "icon", 4, "ngIf"], [1, "debug", 3, "icon"], [1, "info", 3, "icon"], [1, "warn", 3, "icon"], [1, "error", 3, "icon"], [1, "check", 3, "icon"], [1, "level", 3, "ngClass"], [1, "date"], [1, "scope"], [1, "args", 3, "innerHTML"]], template: function EventsLogComponent_Template(rf, ctx) { if (rf & 1) {
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "section");
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](1, "div", 0);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](2, "h3");
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](3, "Events log");
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](4, "div", 1);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](5, "div", 2);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵlistener"]("click", function EventsLogComponent_Template_div_click_5_listener() { return ctx.showOptions = !ctx.showOptions; });
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](6, "span");
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelement"](7, "fa-icon", 3);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](8, "Filters");
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelement"](9, "fa-icon", 3);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](10, EventsLogComponent_div_10_Template, 27, 10, "div", 4);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](11, "ul", 5);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵlistener"]("scrolledUp", function EventsLogComponent_Template_ul_scrolledUp_11_listener() { return ctx.onScrollUp(); });
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](12, EventsLogComponent_li_12_Template, 9, 7, "li", 6);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    } if (rf & 2) {
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](7);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("icon", ctx.faFilter);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](2);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("icon", ctx.faChevron);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngIf", ctx.showOptions);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("infiniteScrollUpDistance", 1.5)("infiniteScrollThrottle", 50);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngForOf", ctx.logs);
    } }, directives: [_fortawesome_angular_fontawesome__WEBPACK_IMPORTED_MODULE_3__["FaIconComponent"], _angular_common__WEBPACK_IMPORTED_MODULE_4__["NgIf"], ngx_infinite_scroll__WEBPACK_IMPORTED_MODULE_5__["InfiniteScrollDirective"], _angular_common__WEBPACK_IMPORTED_MODULE_4__["NgForOf"], _angular_common__WEBPACK_IMPORTED_MODULE_4__["NgClass"]], pipes: [_safe_html_pipe__WEBPACK_IMPORTED_MODULE_6__["SafeHtmlPipe"]], styles: ["section[_ngcontent-%COMP%] {\n  height: calc(100vh - 120px);\n  padding: 10px;\n}\n\nul[_ngcontent-%COMP%] {\n  height: calc(100vh - 175px);\n  overflow-y: scroll;\n}\n\nspan[_ngcontent-%COMP%] {\n  margin: 0 2px;\n}\n\n.level.cyan[_ngcontent-%COMP%] {\n  color: #00e5ff;\n}\n\n.level.blue[_ngcontent-%COMP%] {\n  color: #3d5afe;\n}\n\n.level.green[_ngcontent-%COMP%] {\n  color: #b0ff57;\n}\n\n.level.orange[_ngcontent-%COMP%] {\n  color: #ffc400;\n}\n\n.level.red[_ngcontent-%COMP%] {\n  color: #ff1744;\n}\n\n.date[_ngcontent-%COMP%] {\n  color: #616161;\n}\n\n.scope[_ngcontent-%COMP%] {\n  font-weight: bold;\n  color: white;\n}\n\n.filters[_ngcontent-%COMP%] {\n  cursor: pointer;\n  background-color: #616161;\n  height: 20px;\n  width: 100px;\n}\n\n.filters[_ngcontent-%COMP%]   .trigger[_ngcontent-%COMP%] {\n  background-color: #616161;\n  padding: 2px 7px;\n  display: flex;\n  flex-direction: row;\n  justify-content: space-between;\n  align-items: center;\n}\n\n.filters[_ngcontent-%COMP%]   .trigger[_ngcontent-%COMP%]   span[_ngcontent-%COMP%] {\n  display: flex;\n}\n\n.filters[_ngcontent-%COMP%]   .trigger[_ngcontent-%COMP%]   span[_ngcontent-%COMP%]   fa-icon[_ngcontent-%COMP%] {\n  margin-right: 5px;\n  width: 15px;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n}\n\n.filters[_ngcontent-%COMP%]   .options[_ngcontent-%COMP%] {\n  position: absolute;\n  z-index: 10;\n  width: 100px;\n  height: 120px;\n  background-color: #616161;\n}\n\n.filters[_ngcontent-%COMP%]   .silly[_ngcontent-%COMP%] {\n  color: #00e5ff;\n}\n\n.filters[_ngcontent-%COMP%]   .debug[_ngcontent-%COMP%] {\n  color: #3d5afe;\n}\n\n.filters[_ngcontent-%COMP%]   .info[_ngcontent-%COMP%] {\n  color: #b0ff57;\n}\n\n.filters[_ngcontent-%COMP%]   .warn[_ngcontent-%COMP%] {\n  color: #ffc400;\n}\n\n.filters[_ngcontent-%COMP%]   .error[_ngcontent-%COMP%] {\n  color: #ff1744;\n}\n\n.filters[_ngcontent-%COMP%]   li[_ngcontent-%COMP%] {\n  padding: 2px 7px;\n  height: 20px;\n  display: flex;\n  flex-direction: row;\n  justify-content: space-between;\n  align-items: center;\n}\n\n.filters[_ngcontent-%COMP%]   li[_ngcontent-%COMP%]   span[_ngcontent-%COMP%] {\n  display: flex;\n}\n\n.filters[_ngcontent-%COMP%]   li[_ngcontent-%COMP%]   fa-icon[_ngcontent-%COMP%] {\n  margin-right: 5px;\n  width: 15px;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n}\n\n.filters[_ngcontent-%COMP%]   li[_ngcontent-%COMP%]   fa-icon.check[_ngcontent-%COMP%] {\n  margin: 0;\n}\n\n.heading[_ngcontent-%COMP%] {\n  display: flex;\n  justify-content: space-between;\n  align-items: baseline;\n}\n/*# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInNyYy9hcHAvZXZlbnRzLWxvZy9ldmVudHMtbG9nLmNvbXBvbmVudC5zY3NzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0VBQ0UsMkJBQUE7RUFDQSxhQUFBO0FBQ0Y7O0FBRUE7RUFDRSwyQkFBQTtFQUNBLGtCQUFBO0FBQ0Y7O0FBRUE7RUFDRSxhQUFBO0FBQ0Y7O0FBR0U7RUFDRSxjQUFBO0FBQUo7O0FBRUU7RUFDRSxjQUFBO0FBQUo7O0FBRUU7RUFDRSxjQUFBO0FBQUo7O0FBRUU7RUFDRSxjQUFBO0FBQUo7O0FBRUU7RUFDRSxjQUFBO0FBQUo7O0FBSUE7RUFDRSxjQUFBO0FBREY7O0FBSUE7RUFDRSxpQkFBQTtFQUNBLFlBQUE7QUFERjs7QUFJQTtFQUNFLGVBQUE7RUFDQSx5QkFBQTtFQUNBLFlBQUE7RUFDQSxZQUFBO0FBREY7O0FBRUU7RUFDRSx5QkFBQTtFQUNBLGdCQUFBO0VBQ0EsYUFBQTtFQUNBLG1CQUFBO0VBQ0EsOEJBQUE7RUFDQSxtQkFBQTtBQUFKOztBQUNJO0VBQ0UsYUFBQTtBQUNOOztBQUFNO0VBQ0UsaUJBQUE7RUFDQSxXQUFBO0VBQ0EsYUFBQTtFQUNBLG1CQUFBO0VBQ0EsdUJBQUE7QUFFUjs7QUFFRTtFQUNFLGtCQUFBO0VBQ0EsV0FBQTtFQUNBLFlBQUE7RUFDQSxhQUFBO0VBQ0EseUJBQUE7QUFBSjs7QUFFRTtFQUNFLGNBQUE7QUFBSjs7QUFFRTtFQUNFLGNBQUE7QUFBSjs7QUFFRTtFQUNFLGNBQUE7QUFBSjs7QUFFRTtFQUNFLGNBQUE7QUFBSjs7QUFFRTtFQUNFLGNBQUE7QUFBSjs7QUFFRTtFQWNFLGdCQUFBO0VBQ0EsWUFBQTtFQUNBLGFBQUE7RUFDQSxtQkFBQTtFQUNBLDhCQUFBO0VBQ0EsbUJBQUE7QUFiSjs7QUFMSTtFQUNFLGFBQUE7QUFPTjs7QUFMSTtFQUNFLGlCQUFBO0VBQ0EsV0FBQTtFQUNBLGFBQUE7RUFDQSxtQkFBQTtFQUNBLHVCQUFBO0FBT047O0FBTEk7RUFDRSxTQUFBO0FBT047O0FBSUE7RUFDRSxhQUFBO0VBQ0EsOEJBQUE7RUFDQSxxQkFBQTtBQURGIiwiZmlsZSI6InNyYy9hcHAvZXZlbnRzLWxvZy9ldmVudHMtbG9nLmNvbXBvbmVudC5zY3NzIiwic291cmNlc0NvbnRlbnQiOlsic2VjdGlvbiB7XG4gIGhlaWdodDogY2FsYygxMDB2aCAtIDEyMHB4KTtcbiAgcGFkZGluZzogMTBweDtcbn1cblxudWwge1xuICBoZWlnaHQ6IGNhbGMoMTAwdmggLSAxNzVweCk7XG4gIG92ZXJmbG93LXk6IHNjcm9sbDtcbn1cblxuc3BhbiB7XG4gIG1hcmdpbjogMCAycHg7XG59XG5cbi5sZXZlbCB7XG4gICYuY3lhbiB7XG4gICAgY29sb3I6ICMwMGU1ZmY7XG4gIH1cbiAgJi5ibHVlIHtcbiAgICBjb2xvcjogIzNkNWFmZTtcbiAgfVxuICAmLmdyZWVuIHtcbiAgICBjb2xvcjogI2IwZmY1NztcbiAgfVxuICAmLm9yYW5nZSB7XG4gICAgY29sb3I6ICNmZmM0MDA7XG4gIH1cbiAgJi5yZWQge1xuICAgIGNvbG9yOiAjZmYxNzQ0O1xuICB9XG59XG5cbi5kYXRlIHtcbiAgY29sb3I6ICM2MTYxNjE7XG59XG5cbi5zY29wZSB7XG4gIGZvbnQtd2VpZ2h0OiBib2xkO1xuICBjb2xvcjogd2hpdGU7XG59XG5cbi5maWx0ZXJzIHtcbiAgY3Vyc29yOiBwb2ludGVyO1xuICBiYWNrZ3JvdW5kLWNvbG9yOiAjNjE2MTYxO1xuICBoZWlnaHQ6IDIwcHg7XG4gIHdpZHRoOiAxMDBweDtcbiAgLnRyaWdnZXIge1xuICAgIGJhY2tncm91bmQtY29sb3I6ICM2MTYxNjE7XG4gICAgcGFkZGluZzogMnB4IDdweDtcbiAgICBkaXNwbGF5OiBmbGV4O1xuICAgIGZsZXgtZGlyZWN0aW9uOiByb3c7XG4gICAganVzdGlmeS1jb250ZW50OiBzcGFjZS1iZXR3ZWVuO1xuICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgc3BhbiB7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgZmEtaWNvbiB7XG4gICAgICAgIG1hcmdpbi1yaWdodDogNXB4O1xuICAgICAgICB3aWR0aDogMTVweDtcbiAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIC5vcHRpb25zIHtcbiAgICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gICAgei1pbmRleDogMTA7XG4gICAgd2lkdGg6IDEwMHB4O1xuICAgIGhlaWdodDogMTIwcHg7XG4gICAgYmFja2dyb3VuZC1jb2xvcjogIzYxNjE2MTtcbiAgfVxuICAuc2lsbHkge1xuICAgIGNvbG9yOiAjMDBlNWZmO1xuICB9XG4gIC5kZWJ1ZyB7XG4gICAgY29sb3I6ICMzZDVhZmU7XG4gIH1cbiAgLmluZm8ge1xuICAgIGNvbG9yOiAjYjBmZjU3O1xuICB9XG4gIC53YXJuIHtcbiAgICBjb2xvcjogI2ZmYzQwMDtcbiAgfVxuICAuZXJyb3Ige1xuICAgIGNvbG9yOiAjZmYxNzQ0O1xuICB9XG4gIGxpIHtcbiAgICBzcGFuIHtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgfVxuICAgIGZhLWljb24ge1xuICAgICAgbWFyZ2luLXJpZ2h0OiA1cHg7XG4gICAgICB3aWR0aDogMTVweDtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgfVxuICAgIGZhLWljb24uY2hlY2sge1xuICAgICAgbWFyZ2luOiAwO1xuICAgIH1cbiAgICBwYWRkaW5nOiAycHggN3B4O1xuICAgIGhlaWdodDogMjBweDtcbiAgICBkaXNwbGF5OiBmbGV4O1xuICAgIGZsZXgtZGlyZWN0aW9uOiByb3c7XG4gICAganVzdGlmeS1jb250ZW50OiBzcGFjZS1iZXR3ZWVuO1xuICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gIH1cbn1cblxuLmhlYWRpbmcge1xuICBkaXNwbGF5OiBmbGV4O1xuICBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW47XG4gIGFsaWduLWl0ZW1zOiBiYXNlbGluZTtcbn1cbiJdfQ== */"] });
/*@__PURE__*/ (function () { _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵsetClassMetadata"](EventsLogComponent, [{
        type: _angular_core__WEBPACK_IMPORTED_MODULE_0__["Component"],
        args: [{
                selector: 'app-events-log',
                templateUrl: './events-log.component.html',
                styleUrls: ['./events-log.component.scss']
            }]
    }], function () { return [{ type: _mila_service__WEBPACK_IMPORTED_MODULE_2__["MilaService"] }]; }, null); })();


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
/* harmony import */ var _tabs_service__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../tabs.service */ "2UJW");
/* harmony import */ var _angular_common__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @angular/common */ "ofXK");





function NodesListComponent_h3_1_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "h3");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](1, "Shared packages");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
} }
function NodesListComponent_ul_2_li_1_Template(rf, ctx) { if (rf & 1) {
    const _r7 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵgetCurrentView"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "li", 5);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵlistener"]("click", function NodesListComponent_ul_2_li_1_Template_li_click_0_listener() { _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵrestoreView"](_r7); const pkg_r5 = ctx.$implicit; const ctx_r6 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"](2); return ctx_r6.tabs.openTab("node-details", pkg_r5.name); });
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](1, "span", 6);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](3, "span", 7);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](4);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](5, "span", 7);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](6);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
} if (rf & 2) {
    const pkg_r5 = ctx.$implicit;
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtextInterpolate"](pkg_r5.name);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngClass", pkg_r5.transpiledClass);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtextInterpolate"](pkg_r5.transpiled);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngClass", pkg_r5.typeCheckClass);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtextInterpolate"](pkg_r5.typeChecked);
} }
function NodesListComponent_ul_2_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "ul", 3);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](1, NodesListComponent_ul_2_li_1_Template, 7, 5, "li", 4);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
} if (rf & 2) {
    const ctx_r1 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngForOf", ctx_r1.packages);
} }
function NodesListComponent_h3_3_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "h3");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](1, "Services");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
} }
function NodesListComponent_ul_4_li_1_span_3_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "span", 11);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](1, "Disabled");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
} }
function NodesListComponent_ul_4_li_1_span_4_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "span", 7);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
} if (rf & 2) {
    const service_r9 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"]().$implicit;
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngClass", service_r9.typeCheckClass);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtextInterpolate"](service_r9.typeChecked);
} }
function NodesListComponent_ul_4_li_1_span_5_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "span", 7);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
} if (rf & 2) {
    const service_r9 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"]().$implicit;
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngClass", service_r9.statusClass);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtextInterpolate"](service_r9.status);
} }
function NodesListComponent_ul_4_li_1_Template(rf, ctx) { if (rf & 1) {
    const _r16 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵgetCurrentView"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "li", 5);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵlistener"]("click", function NodesListComponent_ul_4_li_1_Template_li_click_0_listener() { _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵrestoreView"](_r16); const service_r9 = ctx.$implicit; const ctx_r15 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"](2); return ctx_r15.tabs.openTab("node-details", service_r9.name); });
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](1, "span", 6);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](3, NodesListComponent_ul_4_li_1_span_3_Template, 2, 0, "span", 9);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](4, NodesListComponent_ul_4_li_1_span_4_Template, 2, 2, "span", 10);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](5, NodesListComponent_ul_4_li_1_span_5_Template, 2, 2, "span", 10);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
} if (rf & 2) {
    const service_r9 = ctx.$implicit;
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtextInterpolate"](service_r9.name);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngIf", service_r9.disabled);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngIf", !service_r9.disabled);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngIf", !service_r9.disabled);
} }
function NodesListComponent_ul_4_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "ul", 8);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](1, NodesListComponent_ul_4_li_1_Template, 6, 4, "li", 4);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
} if (rf & 2) {
    const ctx_r3 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngForOf", ctx_r3.services);
} }
class NodesListComponent {
    constructor(mila, tabs) {
        this.mila = mila;
        this.tabs = tabs;
    }
    ngOnInit() {
        // FIXME: take until
        this.mila.packages$.subscribe((p) => this.packages = p);
        this.mila.services$.subscribe((s) => this.services = s);
        this.mila.getGraph();
    }
}
NodesListComponent.ɵfac = function NodesListComponent_Factory(t) { return new (t || NodesListComponent)(_angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵdirectiveInject"](_mila_service__WEBPACK_IMPORTED_MODULE_1__["MilaService"]), _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵdirectiveInject"](_tabs_service__WEBPACK_IMPORTED_MODULE_2__["TabsService"])); };
NodesListComponent.ɵcmp = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵdefineComponent"]({ type: NodesListComponent, selectors: [["app-nodes-list"]], inputs: { filter: "filter" }, decls: 5, vars: 4, consts: [[4, "ngIf"], ["class", "packages", 4, "ngIf"], ["class", "services", 4, "ngIf"], [1, "packages"], [3, "click", 4, "ngFor", "ngForOf"], [3, "click"], [1, "name"], [1, "status", 3, "ngClass"], [1, "services"], ["class", "status", 4, "ngIf"], ["class", "status", 3, "ngClass", 4, "ngIf"], [1, "status"]], template: function NodesListComponent_Template(rf, ctx) { if (rf & 1) {
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "section");
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](1, NodesListComponent_h3_1_Template, 2, 0, "h3", 0);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](2, NodesListComponent_ul_2_Template, 2, 1, "ul", 1);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](3, NodesListComponent_h3_3_Template, 2, 0, "h3", 0);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](4, NodesListComponent_ul_4_Template, 2, 1, "ul", 2);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    } if (rf & 2) {
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngIf", !ctx.filter || ctx.filter === "packages");
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngIf", !ctx.filter || ctx.filter === "packages");
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngIf", !ctx.filter || ctx.filter === "services");
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngIf", !ctx.filter || ctx.filter === "services");
    } }, directives: [_angular_common__WEBPACK_IMPORTED_MODULE_3__["NgIf"], _angular_common__WEBPACK_IMPORTED_MODULE_3__["NgForOf"], _angular_common__WEBPACK_IMPORTED_MODULE_3__["NgClass"]], styles: ["section[_ngcontent-%COMP%] {\n  min-width: 400px;\n  height: calc(100vh - 120px);\n  overflow-y: scroll;\n  padding: 10px;\n}\n\nul[_ngcontent-%COMP%] {\n  margin: 0;\n  padding: 0;\n}\n\nul[_ngcontent-%COMP%]   li[_ngcontent-%COMP%] {\n  margin: 5px 0;\n  cursor: pointer;\n}\n\nul[_ngcontent-%COMP%]   span[_ngcontent-%COMP%] {\n  font-size: 10pt;\n  margin: 0 2px;\n}\n\nul[_ngcontent-%COMP%]   span.status[_ngcontent-%COMP%] {\n  padding: 2px 5px;\n  background-color: #616161;\n  border-radius: 5px;\n}\n\nul[_ngcontent-%COMP%]   span.status.red[_ngcontent-%COMP%] {\n  background-color: #e53935;\n}\n\nul[_ngcontent-%COMP%]   span.status.bright-red[_ngcontent-%COMP%] {\n  background-color: #ff1744;\n}\n\nul[_ngcontent-%COMP%]   span.status.green[_ngcontent-%COMP%] {\n  background-color: #43a047;\n}\n\nul[_ngcontent-%COMP%]   span.status.blue[_ngcontent-%COMP%] {\n  background-color: #1565c0;\n}\n/*# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInNyYy9hcHAvbm9kZXMtbGlzdC9ub2Rlcy1saXN0LmNvbXBvbmVudC5zY3NzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQU1BO0VBQ0UsZ0JBQUE7RUFDQSwyQkFBQTtFQUNBLGtCQUFBO0VBQ0EsYUFBQTtBQUxGOztBQVFBO0VBQ0UsU0FBQTtFQUNBLFVBQUE7QUFMRjs7QUFNRTtFQUNFLGFBQUE7RUFDQSxlQUFBO0FBSko7O0FBTUU7RUFDRSxlQUFBO0VBQ0EsYUFBQTtBQUpKOztBQU1FO0VBQ0UsZ0JBQUE7RUFDQSx5QkF4Qkc7RUF5Qkgsa0JBQUE7QUFKSjs7QUFLSTtFQUNFLHlCQTdCQTtBQTBCTjs7QUFLSTtFQUNFLHlCQS9CTztBQTRCYjs7QUFLSTtFQUNFLHlCQWhDRTtBQTZCUjs7QUFLSTtFQUNFLHlCQWxDQztBQStCUCIsImZpbGUiOiJzcmMvYXBwL25vZGVzLWxpc3Qvbm9kZXMtbGlzdC5jb21wb25lbnQuc2NzcyIsInNvdXJjZXNDb250ZW50IjpbIiRyZWQ6ICNlNTM5MzU7XG4kYnJpZ2h0LXJlZDogI2ZmMTc0NDtcbiRncmV5OiAjNjE2MTYxO1xuJGdyZWVuOiAjNDNhMDQ3O1xuJGJsdWU6ICMxNTY1YzA7XG5cbnNlY3Rpb24ge1xuICBtaW4td2lkdGg6IDQwMHB4O1xuICBoZWlnaHQ6IGNhbGMoMTAwdmggLSAxMjBweCk7XG4gIG92ZXJmbG93LXk6IHNjcm9sbDtcbiAgcGFkZGluZzogMTBweDtcbn1cblxudWwge1xuICBtYXJnaW46IDA7XG4gIHBhZGRpbmc6IDA7XG4gIGxpIHtcbiAgICBtYXJnaW46IDVweCAwO1xuICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgfVxuICBzcGFuIHtcbiAgICBmb250LXNpemU6IDEwcHQ7XG4gICAgbWFyZ2luOiAwIDJweDtcbiAgfVxuICBzcGFuLnN0YXR1cyB7XG4gICAgcGFkZGluZzogMnB4IDVweDtcbiAgICBiYWNrZ3JvdW5kLWNvbG9yOiAkZ3JleTtcbiAgICBib3JkZXItcmFkaXVzOiA1cHg7XG4gICAgJi5yZWQge1xuICAgICAgYmFja2dyb3VuZC1jb2xvcjogJHJlZDtcbiAgICB9XG4gICAgJi5icmlnaHQtcmVkIHtcbiAgICAgIGJhY2tncm91bmQtY29sb3I6ICRicmlnaHQtcmVkO1xuICAgIH1cbiAgICAmLmdyZWVuIHtcbiAgICAgIGJhY2tncm91bmQtY29sb3I6ICRncmVlbjtcbiAgICB9XG4gICAgJi5ibHVlIHtcbiAgICAgIGJhY2tncm91bmQtY29sb3I6ICRibHVlO1xuICAgIH1cbiAgfVxufVxuIl19 */"] });
/*@__PURE__*/ (function () { _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵsetClassMetadata"](NodesListComponent, [{
        type: _angular_core__WEBPACK_IMPORTED_MODULE_0__["Component"],
        args: [{
                selector: 'app-nodes-list',
                templateUrl: './nodes-list.component.html',
                styleUrls: ['./nodes-list.component.scss']
            }]
    }], function () { return [{ type: _mila_service__WEBPACK_IMPORTED_MODULE_1__["MilaService"] }, { type: _tabs_service__WEBPACK_IMPORTED_MODULE_2__["TabsService"] }]; }, { filter: [{
            type: _angular_core__WEBPACK_IMPORTED_MODULE_0__["Input"]
        }] }); })();


/***/ }),

/***/ "vSZq":
/*!********************************************************!*\
  !*** ./src/app/service-logs/service-logs.component.ts ***!
  \********************************************************/
/*! exports provided: ServiceLogsComponent */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "ServiceLogsComponent", function() { return ServiceLogsComponent; });
/* harmony import */ var _angular_core__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @angular/core */ "fXoL");
/* harmony import */ var ansi_to_html__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ansi-to-html */ "YavU");
/* harmony import */ var ansi_to_html__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(ansi_to_html__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _mila_service__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../mila.service */ "Bhgz");
/* harmony import */ var _angular_common__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @angular/common */ "ofXK");
/* harmony import */ var _safe_html_pipe__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../safe-html.pipe */ "ZJwn");






const convert = new ansi_to_html__WEBPACK_IMPORTED_MODULE_1__();
class ServiceLogsComponent {
    constructor(mila) {
        this.mila = mila;
    }
    ngOnInit() {
        this.mila.serviceLogs$.subscribe((log) => {
            console.log('BBBB', log);
            this.log = convert.toHtml(log.offline.join('').replace(/(\r\n|\n|\r)/gm, "<br />"));
            this._scrollToEnd();
        });
    }
    _scrollToEnd() {
        console.log('scrolling');
        setTimeout(() => {
            const elt = document.getElementById('service-logs');
            elt.scrollTo({ behavior: 'smooth', top: elt.scrollHeight - elt.clientHeight });
        }, 0);
    }
}
ServiceLogsComponent.ɵfac = function ServiceLogsComponent_Factory(t) { return new (t || ServiceLogsComponent)(_angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵdirectiveInject"](_mila_service__WEBPACK_IMPORTED_MODULE_2__["MilaService"])); };
ServiceLogsComponent.ɵcmp = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵdefineComponent"]({ type: ServiceLogsComponent, selectors: [["app-service-logs"]], decls: 6, vars: 6, consts: [["id", "service-logs", 1, "mono", 3, "innerHTML"]], template: function ServiceLogsComponent_Template(rf, ctx) { if (rf & 1) {
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "section");
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](1, "h3");
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](2);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵpipe"](3, "async");
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelement"](4, "div", 0);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵpipe"](5, "safeHtml");
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    } if (rf & 2) {
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](2);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtextInterpolate1"]("", _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵpipeBind1"](3, 2, ctx.mila.currentService$), " logs");
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](2);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("innerHTML", _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵpipeBind1"](5, 4, ctx.log), _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵsanitizeHtml"]);
    } }, pipes: [_angular_common__WEBPACK_IMPORTED_MODULE_3__["AsyncPipe"], _safe_html_pipe__WEBPACK_IMPORTED_MODULE_4__["SafeHtmlPipe"]], styles: ["section[_ngcontent-%COMP%] {\n  padding: 10px;\n}\n\n.mono[_ngcontent-%COMP%] {\n  height: calc(100vh - 175px);\n  overflow-y: scroll;\n}\n/*# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInNyYy9hcHAvc2VydmljZS1sb2dzL3NlcnZpY2UtbG9ncy5jb21wb25lbnQuc2NzcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtFQUNFLGFBQUE7QUFDRjs7QUFFQTtFQUNFLDJCQUFBO0VBQ0Esa0JBQUE7QUFDRiIsImZpbGUiOiJzcmMvYXBwL3NlcnZpY2UtbG9ncy9zZXJ2aWNlLWxvZ3MuY29tcG9uZW50LnNjc3MiLCJzb3VyY2VzQ29udGVudCI6WyJzZWN0aW9uIHtcbiAgcGFkZGluZzogMTBweDtcbn1cblxuLm1vbm8ge1xuICBoZWlnaHQ6IGNhbGMoMTAwdmggLSAxNzVweCk7XG4gIG92ZXJmbG93LXk6IHNjcm9sbDtcbn1cbiJdfQ== */"] });
/*@__PURE__*/ (function () { _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵsetClassMetadata"](ServiceLogsComponent, [{
        type: _angular_core__WEBPACK_IMPORTED_MODULE_0__["Component"],
        args: [{
                selector: 'app-service-logs',
                templateUrl: './service-logs.component.html',
                styleUrls: ['./service-logs.component.scss']
            }]
    }], function () { return [{ type: _mila_service__WEBPACK_IMPORTED_MODULE_2__["MilaService"] }]; }, null); })();


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