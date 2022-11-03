import { SinonStub, stub } from 'sinon';
import { PutItemInput } from 'aws-sdk/clients/dynamodb';

import { mockCompany, mockUser } from '@dataportal/test-helpers';
import { ICompany, IUser, IUserAdInformation } from '@dataportal/types';
import { CompanyModel, UserModel } from '@dataportal/models';

import { handler } from '../../../../src/handlers/routines/sync-ad-companies';

let stubCompanyList: SinonStub<[], Promise<ICompany[]>>;
let stubUserListAd: SinonStub<[], Promise<IUser[]>>;
let stubCompanySave: SinonStub<[ICompany, Partial<PutItemInput>?], Promise<ICompany>>;

describe('The sync AD companies routine handler', () => {
  const companiesName: string[] = [
    'company1',
    'company2',
    'company3',
    'company4',
    'company5',
    'company6',
    'company7',
    'company8',
    'company9',
  ];
  let oldCompanies: ICompany[];
  let newCompanies: ICompany[];
  let usersAdWithOldCompanies: IUser[];
  let usersAdWithOldAndNewCompanies: IUser[];
  let usersAdWithOldAndNewAndWrongFormattedCompanies: IUser[];

  beforeAll(async () => {
    oldCompanies = [
      mockCompany({ companyName: companiesName[0], sort_field: companiesName[0] }),
      mockCompany({ companyName: companiesName[1], sort_field: companiesName[1] }),
      mockCompany({ companyName: companiesName[2], sort_field: companiesName[2] }),
    ];

    newCompanies = [
      mockCompany({ companyName: companiesName[3], sort_field: companiesName[3] }),
      mockCompany({ companyName: companiesName[4], sort_field: companiesName[4] }),
    ];

    const commonAdInformation: IUserAdInformation = {
      companyName: 'companyName',
      country: 'country',
      displayName: 'displayName',
      id: 'id',
      jobTitle: 'jobTitle',
      mail: 'mail',
      officeLocation: 'officeLocation',
      postalCode: 'postalCode',
    };

    usersAdWithOldCompanies = [
      mockUser({ pk: 'user1', ad_information: { ...commonAdInformation, companyName: oldCompanies[0].companyName } }),
      mockUser({ pk: 'user2', ad_information: { ...commonAdInformation, companyName: oldCompanies[1].companyName } }),
      mockUser({ pk: 'user3', ad_information: { ...commonAdInformation, companyName: oldCompanies[2].companyName } }),
    ];

    usersAdWithOldAndNewCompanies = [
      ...usersAdWithOldCompanies,
      mockUser({ pk: 'user4', ad_information: { ...commonAdInformation, companyName: newCompanies[0].companyName } }),
      mockUser({ pk: 'user5', ad_information: { ...commonAdInformation, companyName: newCompanies[1].companyName } }),
    ];

    usersAdWithOldAndNewAndWrongFormattedCompanies = [
      ...usersAdWithOldAndNewCompanies,
      mockUser({
        pk: 'user6',
        ad_information: null,
      }),
      mockUser({
        pk: 'user7',
        ad_information: { ...commonAdInformation, companyName: null },
      }),
      mockUser({
        pk: 'user8',
        ad_information: { ...commonAdInformation, companyName: '' },
      }),
      mockUser({
        pk: 'user9',
        ad_information: { ...commonAdInformation, companyName: '-' },
      }),
    ];
  });

  beforeEach(async () => {
    stubCompanyList = stub(CompanyModel.prototype, 'list');
    stubUserListAd = stub(UserModel.prototype, 'listAd');
    stubCompanySave = stub(CompanyModel.prototype, 'save');
  });

  afterEach(async () => {
    stubCompanyList.restore();
    stubUserListAd.restore();
    stubCompanySave.restore();
  });

  afterAll(async () => {
    stubCompanyList.resetHistory();
    stubUserListAd.resetHistory();
    stubCompanySave.resetHistory();
  });

  it('Should save nothing if there is no new AD company', async () => {
    stubCompanyList.resolves(oldCompanies);
    stubUserListAd.resolves(usersAdWithOldCompanies);
    stubCompanySave.resolves();

    await handler(null, null, null);

    expect(stubCompanyList.callCount).toBe(1);
    expect(stubUserListAd.callCount).toBe(1);
    expect(stubCompanySave.callCount).toBe(0);
  });

  it('Should only save the new AD companies', async () => {
    stubCompanyList.resolves(oldCompanies);
    stubUserListAd.resolves(usersAdWithOldAndNewCompanies);
    stubCompanySave.resolves();

    await handler(null, null, null);

    expect(stubCompanyList.callCount).toBe(1);
    expect(stubUserListAd.callCount).toBe(1);
    expect(stubCompanySave.callCount).toBe(2);

    expect(stubCompanySave.getCall(0).args[0]).toHaveProperty('companyName');
    expect(stubCompanySave.getCall(0).args[0].companyName).toEqual(newCompanies[0].companyName);
    expect(stubCompanySave.getCall(1).args[0]).toHaveProperty('companyName');
    expect(stubCompanySave.getCall(1).args[0].companyName).toEqual(newCompanies[1].companyName);
  });

  it('Should only save the new AD companies, and only those which are well formatted', async () => {
    stubCompanyList.resolves(oldCompanies);
    stubUserListAd.resolves(usersAdWithOldAndNewAndWrongFormattedCompanies);
    stubCompanySave.resolves();

    await handler(null, null, null);

    expect(stubCompanyList.callCount).toBe(1);
    expect(stubUserListAd.callCount).toBe(1);
    expect(stubCompanySave.callCount).toBe(2);

    expect(stubCompanySave.getCall(0).args[0]).toHaveProperty('companyName');
    expect(stubCompanySave.getCall(0).args[0].companyName).toEqual(newCompanies[0].companyName);
    expect(stubCompanySave.getCall(1).args[0]).toHaveProperty('companyName');
    expect(stubCompanySave.getCall(1).args[0].companyName).toEqual(newCompanies[1].companyName);
  });
});
