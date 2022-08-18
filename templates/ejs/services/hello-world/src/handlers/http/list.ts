import { ApiHandlerEvent, handle, middleware } from '@dataportal/middleware';
import { CompanyModel } from '@dataportal/models';
import { PermissionsAPI } from '@dataportal/permissions-utils';
import { Handler } from 'aws-lambda';

middleware();

export const handler: Handler = handle(async (event: ApiHandlerEvent) => {
  const companyModel = new CompanyModel();
  await PermissionsAPI.authorize(event, 'update', 'portals');
  return companyModel.list();
});
