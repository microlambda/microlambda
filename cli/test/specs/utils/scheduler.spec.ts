import { RecompilationScheduler } from '../../../src/utils/scheduler';
import { Service } from '../../../src/lerna';

const scheduler = new RecompilationScheduler();

describe('The RecompilationScheduler', () => {
  describe('The requestStop method', () => {
    beforeEach(() => scheduler.reset());
    it('should add stop job if not already in queue', () => {
      const service = { getName: () => 'serviceA' } as Service;
      scheduler.requestStop(service);
      expect(scheduler.getJobs().stop.length).toBe(1);
      expect(scheduler.getJobs().stop).toContain(service);
    });
    it('should not add stop job again if already in queue', () => {
      const service = { getName: () => 'serviceA' } as Service;
      scheduler.requestStop(service);
      scheduler.requestStop(service);
      scheduler.requestStop(service);
      expect(scheduler.getJobs().stop.length).toBe(1);
      expect(scheduler.getJobs().stop).toContain(service);
    });
  });
});
