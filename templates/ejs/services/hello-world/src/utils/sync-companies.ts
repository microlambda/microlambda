import uuid from 'uuid/v4';

import { CompanyModel, UserModel } from '@dataportal/models';
import { ICompany, IUser } from '@dataportal/types';

export const syncCompanies = async (): Promise<ICompany[]> => {
  const companyModel = new CompanyModel();
  const userModel = new UserModel();
  const existingCompanyNames = (await companyModel.list()).map((c) => c.companyName);
  const allAdUsers = await userModel.listAd();
  const companyNamesToCreate: Set<string> = new Set<string>();
  for (const u of allAdUsers) {
    if (await userCompanyNeedToBeAdded(u, existingCompanyNames)) {
      companyNamesToCreate.add(u.ad_information.companyName);
    }
  }
  return Array.from(companyNamesToCreate).map(buildCompanyItem);
};

export const userCompanyNeedToBeAdded = async (u: IUser, existingCompanyNames?: string[]): Promise<boolean> => {
  let alreadyExistingCompanyNames = existingCompanyNames;
  if (!existingCompanyNames) {
    const companyMod = new CompanyModel();
    alreadyExistingCompanyNames = (await companyMod.list()).map((c) => c.companyName);
  }
  if (u.ad_information && u.ad_information.companyName) {
    if (u.ad_information.companyName !== '' && u.ad_information.companyName !== '-') {
      return !alreadyExistingCompanyNames.includes(u.ad_information.companyName);
    }
  }
  return false;
};

const buildCompanyItem = (compName: string): ICompany => {
  return {
    pk: uuid(),
    sk: 'companies',
    companyName: compName,
    sort_field: compName,
  };
};
