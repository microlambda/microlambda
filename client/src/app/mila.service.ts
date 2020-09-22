import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../environments/environment';
import { BehaviorSubject } from 'rxjs';
import * as io from 'socket.io-client';
import { Service } from './service';
import { Package } from './package';
import { IEventLog, Log } from './log';
import { CompilationStatus } from './compilation.status.enum';
import { ServiceStatus } from './service.status.enum';
import { INode } from './node.interface';

/**
 * TODO:
 * - Filterable events log => DONE but perf issue: see how to mitigate it (lazy-load elt in DOM with infinite scroll)
 * - Details (port etc...) => DONE but need styling and so on
 * - Compilation Logs => TODO In CLI put the compilation logs in memory maps that can be queryable from client. Try to preserve ANSI colors and convert to HTML
 * - SLS logs (with search) => TODO Same than above, but also use a websocket for real-time update
 * - Start / Stop / Restart => TODO Emit socket event that are caught in CLI and perform desired operation
 * - Change port => TODO: Same, also create a socket event to update service port in client
 * - Test => TODO Run tests (unit, functional or both) and print output in a web TTY
 * - Package tree => TODO put packagr v2 in codebase and use script and tree-shaking on demand (on HTTP call) to return tree-shaken deps
 * - Package / Deploy => TODO create UI to easily package and deploy services (input aws-region etc...)
 * - Default region / AWS credentials => TODO: Create a screen to see which key pair / profile and default region is currently used
 * - Binaries Versions => TODO: Create a endpoint to see binary path and version (tsc, sls, jest)
 * - Lerna Graph => TODO: Use a graph lib (D3 ?) to print graph in a Airflow DAG way
 * - Resources consumption => TODO Use https://www.npmjs.com/package/pidusage to send resource usage too the front and print them in beatiful D3 charts
 * - Make closable + button add => TODO: Make generic tab (event logs, binary versions etc...) closable and add a button add at the end of toolbar to re-open them
 * - Tab Config used => TODO create a tab printing the currently used .microlambdarc config
 * - Improve terminal based tasks with https://xtermjs.org/
 */

const BASE_URL = environment.production ? window.origin : `http://localhost:${environment.port}`

@Injectable({
  providedIn: 'root'
})
export class MilaService{

  private _connected$ = new BehaviorSubject<boolean>(false);
  private _packages$ = new BehaviorSubject<Package[]>([]);
  private _services$ = new BehaviorSubject<Service[]>([]);
  private _logs$ = new BehaviorSubject<Log[]>([]);
  private _currentService$ = new BehaviorSubject<string>(null);
  private _serviceLogs$ = new BehaviorSubject<string[]>([]);

  // FIXME: Change url
  private _socket = io('http://localhost:4545');

  packages$ = this._packages$.asObservable();
  services$ = this._services$.asObservable();
  log$ = this._logs$.asObservable();
  connected$ = this._connected$.asObservable();
  currentService$ = this._currentService$.asObservable();
  serviceLogs$ = this._serviceLogs$.asObservable();

  constructor(
    private readonly http: HttpClient
  ) {
    this._socket.on('connect', () => {
      console.debug('connected to mila server');
      this._connected$.next(true);
    });
    this._socket.on('disconnect', () => {
      console.debug('disconnected to mila server');
      this._connected$.next(false);
    });
    this._socket.on('compilation.status.updated', (data: { node: string, status: CompilationStatus}) => {
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
    this._socket.on('node.status.updated', (data: { node: string, status: ServiceStatus}) => {
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
    this._socket.on('event.log.added', (log: IEventLog) => {
      console.debug('log received', log);
      const logs = this._logs$.getValue();
      logs.push(new Log(log));
      this._logs$.next(logs);
      console.debug('logs updated', logs);
    });
    this.services$.subscribe((services) => {
      const currentServiceName = this._currentService$.getValue();
      const currentService = currentServiceName ? services.find(s => s.name === currentServiceName) : null;
      if (currentService && currentService.status !== 'Running') {
        this._serviceLogs$.next([]);
      }
    });
  }

  getGraph() {
    return this.http.get<INode[]>(`${BASE_URL}/api/graph`).subscribe((nodes) => {
      this._packages$.next(nodes.filter(n => n.status == null).map(n => new Package(n)));
      this._services$.next(nodes.filter(n => n.status != null).map(n => new Service(n)));
    });
  }

  getLogs() {
    return this.http.get<IEventLog[]>(`${BASE_URL}/api/logs`).subscribe((logs) => {
      console.debug('Received logs', logs.length);
      this._logs$.next(logs.map(l => new Log(l)));
    });
  }

  getNode(name: string): Package | Service {
    const pkg = this._packages$.getValue().find(p => p.name === name);
    if (pkg) {
      return pkg;
    }
    return this._services$.getValue().find(p => p.name === name);
  }

  selectService(name: string) {
    if (this._currentService$.getValue()) {
      this._socket.off(`${this._currentService$.getValue()}.log.added`);
    }
    this._serviceLogs$.next([]);
    this._currentService$.next(name);
    this._socket.emit('send.service.logs', name);
    this.http.get<string[]>(`${BASE_URL}/api/services/${encodeURIComponent(name)}/logs`).subscribe((data) => {
      this._serviceLogs$.next(data);
      this._socket.on(`${name}.log.added`, (data: string) => {
        console.log('Logs received for current service', data);
        const logs = this._serviceLogs$.getValue();
        logs.push(data);
        this._serviceLogs$.next(logs);
      });
    });
  }

  start(service: string) {
    this._socket.emit('service.start', service);
  }

  stop(service: string) {
    this._socket.emit('service.stop', service);
  }

  restart(service: string) {
    this._socket.emit('service.restart', service);
  }
}
