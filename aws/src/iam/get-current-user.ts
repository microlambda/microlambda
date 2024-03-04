import { STS, GetCallerIdentityCommand } from '@aws-sdk/client-sts';

export interface ICurrentUserIAM {
  arn: string;
  projectId?: string;
  username?: string;
}

export interface IAmazonError {
  Code: string;
  message: string;
}

const getUserArn = async (region?: string): Promise<string | undefined> => {
  try {
    const iam = new STS({ region: region ?? 'us-east-1' });
    const currentUser = await iam.send(new GetCallerIdentityCommand({}));
    return currentUser.Arn;
  } catch (e) {
    const err = e as IAmazonError;
    const matches = err.message.match(/User: (.+) is not authorized to perform/);
    if (err.Code === 'AccessDenied' && matches) {
      return matches[1];
    }
    throw e;
  }
};

export const arnToCurrentUserIAM = (arn: string): ICurrentUserIAM => {
  const matches = arn.match(/arn:aws:iam::(.+):user\/(.+)/);
  if (matches?.length) {
    return {
      arn,
      projectId: matches[1],
      username: matches[2],
    };
  }
  return { arn };
};

/**
 * Get the information of the currently connected user.
 */
export const getCurrentUser = async (region?: string): Promise<ICurrentUserIAM> => {
  const arn = await getUserArn(region);
  if (!arn) {
    throw new Error('Unable to resolve current user ARN');
  }

  return arnToCurrentUserIAM(arn);
};
