import { SinonStub, stub } from 'sinon';
import aws from 'aws-sdk';
import {getAccountIAM, IAmazonError} from './aws-account';

describe('[method] getAccountIAM', () => {
  let awsStub: SinonStub;
  beforeEach(() => {
    awsStub = stub(aws, 'IAM');
  });
  afterEach(() => {
    awsStub.restore();
  });
  it('should return currently authenticated user name', async () => {
    awsStub.returns({
      getUser: () => ({
        promise: async (): Promise<{ User: { Arn: string } }> => ({
          User: { Arn: '$arn' },
        }),
      }),
    });
    expect(await getAccountIAM()).toBe('$arn');
  });
  it('should not throw and return username if he has no permission to get himself on AWS IAM', async () => {
    awsStub.returns({
      getUser: () => ({
        promise: async (): Promise<{ User: { Arn: string } }> => {
          throw {
            code: 'AccessDenied',
            message: 'User: $arn is not authorized to perform action $foo on resource $bar',
          };
        },
      }),
    });
    expect(await getAccountIAM()).toBe('$arn');
  });
  it('should throw original error otherwise', async () => {
    awsStub.returns({
      getUser: () => ({
        promise: async (): Promise<{ User: { Arn: string } }> => {
          throw {
            code: 'TokenExpired',
            message: 'Your token is expired',
          };
        },
      }),
    });
    try {
      await getAccountIAM();
      fail();
    } catch (e) {
      expect((e as IAmazonError).code).toBe('TokenExpired');
    }
  });
});
