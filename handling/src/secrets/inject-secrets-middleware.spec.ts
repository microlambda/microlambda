import { injectSecrets } from './inject-secrets-middleware';
import { AwsStub, mockClient } from 'aws-sdk-client-mock';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';
import { MetadataBearer } from '@smithy/types';

describe('The inject secret middleware', () => {
  const mocks: Record<string, AwsStub<object, MetadataBearer, unknown>> = {};
  beforeEach(() => {
    mocks.ssm = mockClient(SSMClient);
    mocks.secretsManager = mockClient(SecretsManagerClient);
    process.env.MY_VAR = 'foo';
    process.env.MY_SECRET_VAR = '${secret:test-secret}';
    process.env.MY_OTHER_SECRET_VAR = '${secret:other-test-secret}';
    process.env.MY_SSM_VAR = '${ssm:test-parameter}';
  });
  afterEach(() => {
    Object.values(mocks).forEach((mock) => mock.reset());
    delete process.env.MY_VAR;
    delete process.env.MY_SECRET_VAR;
    delete process.env.MY_OTHER_SECRET_VAR;
  });
  it('should replace secrets ARNs in environment by secret value', async () => {
    mocks.secretsManager.on(GetSecretValueCommand, { SecretId: 'test-secret' }).resolves({ SecretString: 's3cr3t' });
    mocks.secretsManager
      .on(GetSecretValueCommand, { SecretId: 'other-test-secret' })
      .resolves({ SecretString: 'T0pS3cr3t' });
    mocks.ssm.on(GetParameterCommand, { Name: 'test-parameter' }).resolves({ Parameter: { Value: 'value-from-ssm' } });
    await injectSecrets();
    expect(process.env.MY_SECRET_VAR).toBe('s3cr3t');
    expect(process.env.MY_OTHER_SECRET_VAR).toBe('T0pS3cr3t');
    expect(process.env.MY_SSM_VAR).toBe('value-from-ssm');
  });
  it('should not try to fetch secrets twice', async () => {
    mocks.secretsManager.on(GetSecretValueCommand, { SecretId: 'test-secret' }).resolves({ SecretString: 's3cr3t' });
    mocks.secretsManager
      .on(GetSecretValueCommand, { SecretId: 'other-test-secret' })
      .resolves({ SecretString: 'T0pS3cr3t' });
    mocks.ssm.on(GetParameterCommand, { Name: 'test-parameter' }).resolves({ Parameter: { Value: 'value-from-ssm' } });
    await injectSecrets();
    await injectSecrets();
    expect(process.env.MY_SECRET_VAR).toBe('s3cr3t');
    expect(process.env.MY_OTHER_SECRET_VAR).toBe('T0pS3cr3t');
    expect(process.env.MY_SSM_VAR).toBe('value-from-ssm');
  });
  it('should not crash, set var to null and report errors when middleware cannot fetch secrets', async () => {
    mocks.secretsManager.on(GetSecretValueCommand, { SecretId: 'test-secret' }).rejects(Error('NotFound'));
    mocks.secretsManager
      .on(GetSecretValueCommand, { SecretId: 'other-test-secret' })
      .resolves({ SecretString: 'T0pS3cr3t' });
    mocks.ssm.on(GetParameterCommand, { Name: 'test-parameter' }).rejects(Error('Fobidden'));
    await injectSecrets();
    expect(process.env.MY_SECRET_VAR).toBe(undefined);
    expect(process.env.MY_OTHER_SECRET_VAR).toBe('T0pS3cr3t');
    expect(process.env.MY_SSM_VAR).toBe(undefined);
  });
});
