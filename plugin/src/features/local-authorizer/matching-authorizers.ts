import { IAuthorizerConfig } from "../../types";

export const areAuthorizersMatching = (
  auth1: Partial<IAuthorizerConfig> | undefined,
  auth2: Partial<IAuthorizerConfig> | undefined
): boolean => {
  if (!auth1 || !auth2) {
    return false;
  }
  if (auth1.name === auth2.name) {
    return true;
  }
  return auth1.arn === auth2.arn;
};
