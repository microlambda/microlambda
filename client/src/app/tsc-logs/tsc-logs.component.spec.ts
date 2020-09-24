import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TscLogsComponent } from './tsc-logs.component';

describe('TscLogsComponent', () => {
  let component: TscLogsComponent;
  let fixture: ComponentFixture<TscLogsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ TscLogsComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TscLogsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
