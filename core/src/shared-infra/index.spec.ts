import { SinonStub, stub } from 'sinon';
import * as resolvePath from './resolve-path';
import * as stackDeploy from './stack-deployer';
import { deploySharedInfrastructure } from './index';
import { IRootConfig } from '@microlambda/config';
import { IEnvironment } from '@microlambda/remote-state';
import { SharedInfraDeployEvent, SharedInfraDeployEventType } from './types';
import { Observable } from 'rxjs';

describe('The shared infrastructure module', () => {
  const stubs: Record<string, SinonStub> = {};
  beforeEach(() => {
    stubs.resolvePath = stub(resolvePath, 'resolveSharedInfrastructureYamls');
    stubs.stackDeploy = stub(stackDeploy, 'deploySharedInfraStack');
  });
  afterEach(() => {
    Object.values(stubs).forEach((s) => s.restore());
  });
  it('should send resolved event and complete immediately if there is no shared infrastructure stacks to deploy', (done) => {
    stubs.resolvePath.withArgs({}, '/foo/bar').returns([]);
    const events: Array<SharedInfraDeployEvent> = [];
    deploySharedInfrastructure('/foo/bar', {} as IRootConfig, {} as IEnvironment).subscribe({
      next: (evt) => {
        events.push(evt);
      },
      complete: () => {
        expect(events).toHaveLength(1);
        expect(events[0]).toEqual({ type: SharedInfraDeployEventType.STACKS_RESOLVED, stacks: [] });
        done();
      },
    });
  });
  it('should deploy each stack', (done) => {
    stubs.resolvePath.withArgs({}, '/foo/bar').returns(['/infra/shared/serverless.yml', '/infra/env/serverless.yml']);

    stubs.stackDeploy.withArgs({}, '/foo/bar/infra/shared/serverless.yml').returns(
      new Observable((obs) => {
        obs.next({
          type: SharedInfraDeployEventType.STARTED,
          region: 'eu-west-1',
          env: 'dev',
          stack: '/infra/shared/serverless.yml',
        });
        setTimeout(() => {
          obs.next({
            type: SharedInfraDeployEventType.SUCCEEDED,
            region: 'eu-west-1',
            env: 'dev',
            stack: '/infra/shared/serverless.yml',
          });
          obs.complete();
        }, 20);
      }),
    );
    stubs.stackDeploy.withArgs({}, '/foo/bar/infra/env/serverless.yml').returns(
      new Observable((obs) => {
        obs.next({
          type: SharedInfraDeployEventType.STARTED,
          region: 'eu-west-1',
          env: 'dev',
          stack: '/infra/env/serverless.yml',
        });
        setTimeout(() => {
          obs.next({
            type: SharedInfraDeployEventType.SUCCEEDED,
            region: 'eu-west-1',
            env: 'dev',
            stack: '/infra/env/serverless.yml',
          });
          obs.complete();
        }, 20);
      }),
    );
    const events: Array<SharedInfraDeployEvent> = [];
    deploySharedInfrastructure('/foo/bar', {} as IRootConfig, {} as IEnvironment).subscribe({
      next: (evt) => {
        events.push(evt);
      },
      complete: () => {
        expect(events).toHaveLength(5);
        done();
      },
    });
  });
  it.todo('should not interrupt other stacks deploy process if a stack fails to deploy');
});
