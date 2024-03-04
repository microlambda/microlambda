import { ITargetsConfig } from './package-config';
import { MilaError, MilaErrorCode } from '@microlambda/errors';

interface ICommonRootConfig {
  targets?: ITargetsConfig;
  defaultRuntime: string;
}

export interface IStateConfig {
  defaultRegion: string;
  state: {
    checksums: string;
    table: string;
  };
}

export interface ISingleAccountRootConfig extends ICommonRootConfig, IStateConfig {}

export interface IAccountConfig extends IStateConfig {
  id: string;
}

export interface IMultiAccountRootConfig extends ICommonRootConfig {
  accounts: Record<string, IAccountConfig>;
}

export type IRootConfig = ISingleAccountRootConfig | IMultiAccountRootConfig;

export const isMultiAccountConfig = (config: IRootConfig): config is IMultiAccountRootConfig => {
  return (config as IMultiAccountRootConfig).accounts != null;
};
export const getStateConfig = (config: IRootConfig, account?: string): IStateConfig => {
  if (!isMultiAccountConfig(config)) {
    return {
      state: config.state,
      defaultRegion: config.defaultRegion,
    };
  }
  if (!account) {
    throw new MilaError(
      MilaErrorCode.NO_ACCOUNT_SPECIFIED,
      'A multi-accounts configuration was found and you did not specify an account name or ID.',
    );
  }
  let matchingAccount: IStateConfig | undefined = config.accounts[account];
  if (!matchingAccount) {
    matchingAccount = Object.values(config.accounts).find((a) => a.id === account);
  }
  if (!matchingAccount) {
    throw new MilaError(MilaErrorCode.INVALID_ACCOUNT, `Account "${account}" cannot be found in configuration.`);
  }
  return {
    state: matchingAccount.state,
    defaultRegion: matchingAccount.defaultRegion,
  };
};
