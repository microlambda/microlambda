import { Component, OnInit } from '@angular/core';
import { MilaService } from '../mila.service';

@Component({
  selector: 'app-tsc-logs',
  templateUrl: './tsc-logs.component.html',
  styleUrls: ['./tsc-logs.component.scss']
})
export class TscLogsComponent implements OnInit {
  log = '';
  constructor(public readonly mila: MilaService) { }

  ngOnInit(): void {
    this.mila.getTscLogs().subscribe((log) => {
      this.log = log;
      this._scrollToEnd();
    });
  }

  private _scrollToEnd() {
    console.log('scrolling');
    setTimeout(() =>{
      const elt = document.getElementById('service-logs');
      if (elt) {
        elt.scrollTo({behavior: 'smooth', top: elt.scrollHeight - elt.clientHeight });
      }
    }, 0);
  }
}
