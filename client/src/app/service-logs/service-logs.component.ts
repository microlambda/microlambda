import { Component, OnInit } from '@angular/core';
import { MilaService } from '../mila.service';
import * as Convert from 'ansi-to-html';

const convert = new Convert();

@Component({
  selector: 'app-service-logs',
  templateUrl: './service-logs.component.html',
  styleUrls: ['./service-logs.component.scss']
})
export class ServiceLogsComponent implements OnInit {

  log: string;
  constructor(public readonly mila: MilaService) { }

  ngOnInit(): void {
    this.mila.serviceLogs$.subscribe((log) => {
      console.log('BBBB', log);
      this.log = convert.toHtml(log.offline.join('').replace(/(\r\n|\n|\r)/gm, "<br />"));
      this._scrollToEnd();
    });
  }

  private _scrollToEnd() {
    console.log('scrolling');
    setTimeout(() =>{
      const elt = document.getElementById('service-logs');
      elt.scrollTo({behavior: 'smooth', top: elt.scrollHeight - elt.clientHeight });
    }, 0);
  }
}
