import { Component, OnInit } from '@angular/core';
import { MilaService } from '../mila.service';
import { Log, LogLevel } from '../log';
import {
  faBong,
  faBug,
  faCheck, faChevronDown,
  faExclamation,
  faFilter, faInfo,
  faTimes,
} from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-events-log',
  templateUrl: './events-log.component.html',
  styleUrls: ['./events-log.component.scss']
})
export class EventsLogComponent implements OnInit {
  logs: Log[];
  levels: LogLevel[] = ['info', 'warn', 'error'];
  faFilter = faFilter;
  faCheck = faCheck;
  faBug = faBug;
  faInfo = faInfo;
  faCross = faTimes;
  faAlert = faExclamation;
  faSilly = faBong;
  faChevron = faChevronDown;
  showOptions = false;

  private _logs: Log[] = [];

  constructor(
    private readonly mila: MilaService
  ) { }

  ngOnInit(): void {
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
  private filterLogs() {
    // FIXME: Perf issue, too much logs
    this.logs = this._logs.filter(l => this.levels.includes(l.level));
    console.debug('Filtered logs', this.logs.length);
  }

  private _scrollToEnd() {
    console.log('scrolling');
    setTimeout(() =>{
      const elt = document.getElementById('events-log');
      if (elt) {
        elt.scrollTo({behavior: 'smooth', top: elt.scrollHeight - elt.clientHeight });
      }
    }, 0);
  }

  toggleLevel(level: LogLevel) {
    if (this.levels.includes(level)) {
      this.levels = this.levels.filter(l => l !== level);
    } else {
      this.levels.push(level);
    }
    // Refresh list
    this.filterLogs();
    setTimeout(() => this.showOptions = false, 100);
  }
}
