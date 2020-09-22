import { Component } from '@angular/core';
import { MilaService } from './mila.service';
import { TabsService } from './tabs.service';
import { faTimes } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'client';
  nodeList: string = 'services';
  faTimes = faTimes;
  constructor(public readonly mila: MilaService, public readonly tabs: TabsService) {
  }
}
