import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ServiceLogsComponent } from './service-logs.component';

describe('ServiceLogsComponent', () => {
  let component: ServiceLogsComponent;
  let fixture: ComponentFixture<ServiceLogsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ServiceLogsComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ServiceLogsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
