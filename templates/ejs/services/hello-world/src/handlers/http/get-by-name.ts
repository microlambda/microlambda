import { ApiHandlerEvent, handle, middleware } from '@dataportal/middleware';
import { CompanyModel } from '@dataportal/models';
import { PermissionsAPI } from '@dataportal/permissions-utils';
import { Handler } from 'aws-lambda';

middleware();

export const handler: Handler = handle(async (event: ApiHandlerEvent) => {
  const companyModel = new CompanyModel();
  const companyName = event.pathParameters.name;
  await PermissionsAPI.authorize(event, 'get', 'portals');
  return companyModel.getByName(companyName);
});
