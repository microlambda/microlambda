import { GetUserCommand, IAMClient } from '@aws-sdk/client-iam';

export interface ICurrentUserIAM {
  arn: string;
  projectId?: string;
  username?: string;
}

export interface IAmazonError {
  Code: string;
  message: string;
}

const getUserArn = async (region: string): Promise<string | undefined> => {
  try {
    const iam = new IAMClient({ region });
    const currentUser = await iam.send(new GetUserCommand({}));
    return currentUser.User?.Arn;
  } catch (e) {
    const err = e as IAmazonError;
    const matches = err.message.match(/User: (.+) is not authorized to perform/);
    if (err.Code === 'AccessDenied' && matches) {
      return matches[1];
    }
    throw e;
  }
}

/**
 * Get the information of the currently connected user.
 */
export const getCurrentUser = async (region: string): Promise<ICurrentUserIAM> => {
    const arn = await getUserArn(region);
    if (!arn) {
      throw new Error('Unable to resolve current user ARN');
    }
    const matches = arn.match(/arn:aws:iam::(.+):user\/(.+)/);
    return {
      arn,
      projectId: matches?.at(1),
      username: matches?.at(2),
    }
}
