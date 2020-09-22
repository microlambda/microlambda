import { Component, OnInit } from '@angular/core';
import { TabsService } from '../tabs.service';
import { MilaService } from '../mila.service';
import { Package } from '../package';
import { Service } from '../service';
import { faFileAlt, faHammer, faPlay, faRedo, faStop } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-node-details',
  templateUrl: './node-details.component.html',
  styleUrls: ['./node-details.component.scss']
})
export class NodeDetailsComponent implements OnInit {

  node: Package | Service;
  fa = {
    refresh: faRedo,
    build: faHammer,
    start: faPlay,
    stop: faStop,
    logs: faFileAlt,
  }

  constructor(
    private readonly tabs: TabsService,
    public readonly mila: MilaService,
  ) { }

  ngOnInit(): void {
    // FIXME: take until
    this.tabs.currentTab$.subscribe((tab) => {
      this.node = this.mila.getNode(tab.name);
    });
  }

  openLogs() {
    this.mila.selectService(this.node.name);
    this.tabs.openTab('service-logs', `Logs | ${this.node.name}`)
  }
}
