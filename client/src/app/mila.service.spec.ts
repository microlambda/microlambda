import { TestBed } from '@angular/core/testing';

import { MilaService } from './mila.service';

describe('MilaService', () => {
  let service: MilaService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MilaService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
