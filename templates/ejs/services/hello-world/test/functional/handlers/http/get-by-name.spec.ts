import { CompaniesHelpers, mockCompany, TestBed } from '@dataportal/test-helpers';
import { ICompany } from '@dataportal/types';
import { handler } from '../../../../src/handlers/http/list';

let companiesHelpers: CompaniesHelpers;
let company: ICompany;

describe('The companies get-by-name handler - GET v4/companies/{name}', () => {
  beforeAll(async () => {
    companiesHelpers = new CompaniesHelpers();
    company = mockCompany({
      companyName: 'newCompanyName',
      sort_field: 'newCompanyName',
    });
  });
  beforeEach(async () => {
    await companiesHelpers.save(company);
  });
  afterEach(async () => {
    // Clear global table
    await companiesHelpers.clear();
  });
  it.skip('should return 200 and specified company if user is admin', async () => {
    const testBed = new TestBed(handler);
    const res = await testBed.admin();
    expect(res.statusCode).toBe(200);
    expect(res.body.pk).toBe(company.pk);
  });
  it.skip('should return 200 and specified company if user', async () => {
    const testBed = new TestBed(handler);
    const res = await testBed.user();
    expect(res.statusCode).toBe(200);
    expect(res.body.pk).toBe(company.pk);
  });
});
