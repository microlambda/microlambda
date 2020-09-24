import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppComponent } from './app.component';
import { NodesListComponent } from './nodes-list/nodes-list.component';
import { EventsLogComponent } from './events-log/events-log.component';
import { HttpClientModule } from '@angular/common/http';
import { NgxResizableModule } from '@3dgenomes/ngx-resizable';
import { NodeDetailsComponent } from './node-details/node-details.component';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { ServiceLogsComponent } from './service-logs/service-logs.component';
import { SafeHtmlPipe } from './safe-html.pipe';
import { TscLogsComponent } from './tsc-logs/tsc-logs.component';

@NgModule({
  declarations: [
    AppComponent,
    NodesListComponent,
    EventsLogComponent,
    NodeDetailsComponent,
    ServiceLogsComponent,
    SafeHtmlPipe,
    TscLogsComponent,
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    NgxResizableModule,
    FontAwesomeModule,
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
