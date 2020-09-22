import { Component, Input, OnInit } from '@angular/core';
import { MilaService } from '../mila.service';
import { Service } from '../service';
import { Package } from '../package';
import { TabsService } from '../tabs.service';

@Component({
  selector: 'app-nodes-list',
  templateUrl: './nodes-list.component.html',
  styleUrls: ['./nodes-list.component.scss']
})
export class NodesListComponent implements OnInit {
  packages: Package[];
  services: Service[];
  @Input() filter: string;

  constructor(
    private readonly mila: MilaService,
    public readonly tabs: TabsService,
  ) {}

  ngOnInit(): void {
    // FIXME: take until
    this.mila.packages$.subscribe((p) => this.packages = p);
    this.mila.services$.subscribe((s) => this.services = s);
    this.mila.getGraph();
  }
}
