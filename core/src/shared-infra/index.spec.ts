import { SinonStub, stub } from 'sinon';
import * as stackDeploy from './stack-deployer';

describe('The shared infrastructure module', () => {
  const stubs: Record<string, SinonStub> = {};
  beforeEach(() => {
    stubs.stackDeploy = stub(stackDeploy, 'deploySharedInfraStack');
  });
  afterEach(() => {
    Object.values(stubs).forEach((s) => s.restore());
  });
  it.todo('should send resolved event and complete immediately if there is no shared infrastructure stacks to deploy');
  it.todo('should deploy each stack');
  it.todo('should not interrupt other stacks deploy process if a stack fails to deploy');
});
