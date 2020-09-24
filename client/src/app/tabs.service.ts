import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { MilaService } from './mila.service';

type TabType = 'events-log' | 'node-details' | 'service-logs' | 'binaries' | 'lerna-graph' | 'tsc-logs';

interface ITab {
  // TODO: Add type (details, sls logs, resource etc..)
  type: TabType;
  name: string;
  closable: boolean;
}

const DEFAULT_TAB: ITab = {
  name: 'Events log',
  type: 'events-log',
  closable: false,
};

const DEFAULT_TABS: ITab[] = [
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

@Injectable({
  providedIn: 'root'
})
export class TabsService {

  private _currentTab$ = new BehaviorSubject<ITab>(DEFAULT_TAB);
  private _tabs$ = new BehaviorSubject<ITab[]>(DEFAULT_TABS);
  private _history: ITab[] = [DEFAULT_TAB];

  tabs$ = this._tabs$.asObservable();
  currentTab$ = this._currentTab$.asObservable();

  constructor(private readonly mila: MilaService) { }

  openTab(type: TabType, name: string) {
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

  selectTab(tab: ITab) {
    this._history.push(tab);
    this._currentTab$.next(tab);
    if (tab.type === 'service-logs') {
      this.mila.selectService(tab.name.match(/^Logs \| (.+)$/)[1]);
    }
    if (tab.type === 'tsc-logs') {
      this.mila.setCurrentNode(tab.name.match(/^(.+) | tsc$/)[1]);
    }
  }

  deleteTab(name: string) {
    const tabs = [...this._tabs$.getValue()];
    this._tabs$.next(tabs.filter(t => t.name !== name));
    if (this._history.length > 2) {
      this._history.pop();
      const previous = this._history.pop();
      this._currentTab$.next(previous);
    } else {
     this._history = [];
     this.selectTab(DEFAULT_TAB);
    }
  }
}
