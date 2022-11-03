import { Handler } from 'aws-lambda';

import { middleware } from '@dataportal/middleware';
import { CompanyModel } from '@dataportal/models';

import { syncCompanies } from '../../utils/sync-companies';

middleware();

export const handler: Handler = async () => {
  const companyModel = new CompanyModel();

  const newCompaniesFromAd = await syncCompanies();

  if (!newCompaniesFromAd.length) {
    return;
  }

  await Promise.all(newCompaniesFromAd.map((newCompany) => companyModel.save(newCompany)));
};
