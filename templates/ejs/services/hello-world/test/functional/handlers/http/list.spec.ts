import { CompaniesHelpers, mockCompany, TestBed, PermissionsHelpers, userId } from '@dataportal/test-helpers';
import { ICompany } from '@dataportal/types';
import { handler } from '../../../../src/handlers/http/list';

let companiesHelpers: CompaniesHelpers;
let companies: ICompany[];
let permissionsHelpers: PermissionsHelpers;

describe('The companies list handler - GET v4/companies', () => {
  beforeAll(async () => {
    companiesHelpers = new CompaniesHelpers();
    permissionsHelpers = new PermissionsHelpers('portals');
    let i = 0;
    companies = [...Array(20)].map(() => {
      i++;
      return mockCompany({ companyName: `companyName - ${i}`, sort_field: `companyName - ${i}` });
    });
  });
  beforeEach(async () => {
    await Promise.all(companies.map((c) => companiesHelpers.save(c)));
  });
  afterEach(async () => {
    // Clear global table
    await companiesHelpers.clear();
  });
  it('should return 200 and all companies if user is admin', async () => {
    const testBed = new TestBed(handler);
    const res = await testBed.admin();
    expect(res.statusCode).toBe(200);
    expect(res.body.length).toBe(companies.length);
  });
  it.skip('should return 200 and all companies if user is a portal owner', async () => {
    await permissionsHelpers.grantUser('any-portal-id', userId, ['portalOwner']);
    const testBed = new TestBed(handler);
    const res = await testBed.user();
    expect(res.statusCode).toBe(200);
    expect(res.body.length).toBe(companies.length);
  });
  it('should return 403 and all companies if user isn not admin nor portal owner', async () => {
    const testBed = new TestBed(handler);
    const res = await testBed.user();
    expect(res.statusCode).toBe(403);
  });
});
