import { injectSecrets } from './inject-secrets-middleware';
import { SinonStub, stub } from 'sinon';
import { aws } from '@microlambda/aws';

describe('The inject secret middleware', () => {
  let getSecretValue: SinonStub;
  beforeEach(() => {
    getSecretValue = stub(aws.secretsManager, 'getSecretValue');
    getSecretValue.rejects();
    process.env.MY_VAR = 'foo';
    process.env.MY_SECRET_VAR = '${secret:arn:aws:secretsmanager:eu-west-1:016452633255:secret:/test-secret}';
    process.env.MY_OTHER_SECRET_VAR = '${secret:arn:aws:secretsmanager:eu-west-1:016452633255:secret:/other-test-secret}';
  });
  afterEach(() => {
    getSecretValue.restore();
    delete process.env.MY_VAR;
    delete process.env.MY_SECRET_VAR;
    delete process.env.MY_OTHER_SECRET_VAR;
  });
  it('should replace secrets ARNs in environment by secret value', async () => {
    getSecretValue
      .withArgs('eu-west-1', 'arn:aws:secretsmanager:eu-west-1:016452633255:secret:/test-secret')
      .resolves('s3cr3t');
    getSecretValue
      .withArgs('eu-west-1', 'arn:aws:secretsmanager:eu-west-1:016452633255:secret:/other-test-secret')
      .resolves('T0pS3cr3t');
    await injectSecrets();
    expect(process.env.MY_SECRET_VAR).toBe('s3cr3t');
    expect(process.env.MY_OTHER_SECRET_VAR).toBe('T0pS3cr3t');
  });
  it('should not try to fetch secrets twice', async () => {
    getSecretValue
      .withArgs('eu-west-1', 'arn:aws:secretsmanager:eu-west-1:016452633255:secret:/test-secret')
      .resolves('s3cr3t');
    getSecretValue
      .withArgs('eu-west-1', 'arn:aws:secretsmanager:eu-west-1:016452633255:secret:/other-test-secret')
      .resolves('T0pS3cr3t');
    await injectSecrets();
    await injectSecrets();
    expect(process.env.MY_SECRET_VAR).toBe('s3cr3t');
    expect(process.env.MY_OTHER_SECRET_VAR).toBe('T0pS3cr3t');
  });
  it('should not crash, set var to null and report errors when middleware cannot fetch secrets', async () => {
    getSecretValue
      .withArgs('eu-west-1', 'arn:aws:secretsmanager:eu-west-1:016452633255:secret:/test-secret')
      .rejects('NotFound');
    getSecretValue
      .withArgs('eu-west-1', 'arn:aws:secretsmanager:eu-west-1:016452633255:secret:/other-test-secret')
      .resolves('T0pS3cr3t');
    await injectSecrets();
    expect(process.env.MY_SECRET_VAR).toBe(undefined);
    expect(process.env.MY_OTHER_SECRET_VAR).toBe('T0pS3cr3t');
  });
});
