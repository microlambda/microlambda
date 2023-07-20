import { SinonStub, stub } from 'sinon';
import execa = require('execa');
import { deploySharedInfraStack } from './stack-deployer';
import { IEnvironment } from '@microlambda/remote-state';
import { SharedInfraDeployEventType } from './types';

describe('The stack deployer', () => {
  const stubs: Record<string, SinonStub> = {};
  beforeEach(() => {
    stubs.execa = stub(execa, 'command');
    stubs.execa.rejects();
  });
  afterEach(() => {
    Object.values(stubs).forEach((s) => s.restore());
  });
  it('should try tp deploy stack is each activated region', (done) => {
    stubs.execa.withArgs('npx sls deploy', { env: { ENV: 'dev', AWS_REGION: 'eu-west-1' }, cwd: '/foo/bar' }).returns(
      new Promise((resolve) => {
        setTimeout(() => resolve({}), 30);
      }),
    );
    stubs.execa.withArgs('npx sls deploy', { env: { ENV: 'dev', AWS_REGION: 'us-east-1' }, cwd: '/foo/bar' }).returns(
      new Promise((resolve) => {
        setTimeout(() => resolve({}), 10);
      }),
    );
    stubs.execa
      .withArgs('npx sls deploy', { env: { ENV: 'dev', AWS_REGION: 'ap-southeast-1' }, cwd: '/foo/bar' })
      .rejects(new Error('Boom!'));
    const started: string[] = [];
    const success: string[] = [];
    const failures: string[] = [];
    deploySharedInfraStack(
      { name: 'dev', regions: ['eu-west-1', 'us-east-1', 'ap-southeast-1'] } as IEnvironment,
      '/foo/bar/serverless.yml',
    ).subscribe({
      next: (res) => {
        switch (res.type) {
          case SharedInfraDeployEventType.STARTED:
            started.push(res.region);
            break;
          case SharedInfraDeployEventType.SUCCEEDED:
            success.push(res.region);
            break;
          case SharedInfraDeployEventType.FAILED:
            failures.push(res.region);
            break;
        }
      },
      error: () => fail('Should not error'),
      complete: () => {
        expect(started).toEqual(['eu-west-1', 'us-east-1', 'ap-southeast-1']);
        expect(success).toEqual(['eu-west-1', 'us-east-1']);
        expect(failures).toEqual(['ap-southeast-1']);
        done();
      },
    });
  });
});
