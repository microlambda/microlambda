import { IAM } from 'aws-sdk';

export const getAccountIAM = async (): Promise<string> => {
  try {
    const iam = new IAM();
    const currentUser = await iam.getUser().promise();
    return currentUser.User.Arn;
  } catch (e) {
    if (e.code === 'AccessDenied' && e.message.match(/User: (.+) is not authorized to perform/)) {
      return e.message.match(/User: (.+) is not authorized to perform/)[1];
    }
    throw e;
  }
};
