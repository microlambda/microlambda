import { IAM } from 'aws-sdk';

// TODO: REMOVE deprecated for @microlambda/aws aws.iam.getCurrentUser
export interface IAmazonError {
  code: string;
  message: string;
}

export const getAccountIAM = async (): Promise<string> => {
  try {
    const iam = new IAM();
    const currentUser = await iam.getUser().promise();
    return currentUser.User.Arn;
  } catch (e) {
    const err = e as IAmazonError;
    const matches = err.message.match(/User: (.+) is not authorized to perform/);
    if (err.code === 'AccessDenied' && matches) {
      return matches[1];
    }
    throw e;
  }
};
