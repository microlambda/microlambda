/*
TODO Tetss
 import { SinonStub, stub } from 'sinon';
import { CertificateManager } from '../utils/generate-certificates';
import { CertificateSummary } from 'aws-sdk/clients/acm';

describe('The find closest certificate method', () => {
  let listCertificates: SinonStub<[string], Promise<CertificateSummary[]>>;
  beforeEach(() => {
    listCertificates = stub(CertificateManager.prototype, 'listCertificates');
  });
  afterEach(() => {
    listCertificates.restore();
  });
  const certificateManager = new CertificateManager(null, null);
  it('should find the certificate with the same domain if exact match [sub-domain]', async () => {
    const domain = 'stage.api.domain.com';
    const existing = [
      { DomainName: 'stage.api.domain.com' },
      { DomainName: '*.api.domain.com' },
      { DomainName: '*.domain.com' },
    ];
    const expected = 'stage.api.domain.com';
    listCertificates.resolves(existing);
    const result = await certificateManager.getClosestCertificate('eu-west-1', domain);
    expect(result).toEqual({ DomainName: expected });
  });
  it('should find the closest upper level wildcard certificate [1-level upper]', async () => {
    const domain = 'stage.api.domain.com';
    const existing = [{ DomainName: '*.api.domain.com' }, { DomainName: '*.domain.com' }];
    const expected = '*.api.domain.com';
    listCertificates.resolves(existing);
    const result = await certificateManager.getClosestCertificate('eu-west-1', domain);
    expect(result).toEqual({ DomainName: expected });
  });
  it('should find the closest upper level wildcard certificate [2-levels upper]', async () => {
    const domain = 'stage.api.domain.com';
    const existing = [{ DomainName: '*.domain.com' }];
    const expected = '*.domain.com';
    listCertificates.resolves(existing);
    const result = await certificateManager.getClosestCertificate('eu-west-1', domain);
    expect(result).toEqual({ DomainName: expected });
  });
  it('should return null if no matching certificate [no matching certificates]', async () => {
    const domain = 'stage.api.domain.com';
    const existing = [{ DomainName: 'api.domain.com' }];
    listCertificates.resolves(existing);
    const result = await certificateManager.getClosestCertificate('eu-west-1', domain);
    expect(result).toEqual(null);
  });
  it('should return null if no matching certificate [no certificates]', async () => {
    const domain = 'stage.api.domain.com';
    const existing: CertificateSummary[] = [];
    listCertificates.resolves(existing);
    const result = await certificateManager.getClosestCertificate('eu-west-1', domain);
    expect(result).toEqual(null);
  });
  it('should return null if no matching certificate [no matching certificates/wildcard]', async () => {
    const domain = 'api.domain.com';
    const existing = [{ DomainName: '*.api.domain.com' }, { DomainName: 'domain.com' }];
    listCertificates.resolves(existing);
    const result = await certificateManager.getClosestCertificate('eu-west-1', domain);
    expect(result).toEqual(null);
  });
  it('should return same domain certificate [tld]', async () => {
    const domain = 'domain.com';
    const existing = [{ DomainName: 'domain.com' }];
    const expected = 'domain.com';
    listCertificates.resolves(existing);
    const result = await certificateManager.getClosestCertificate('eu-west-1', domain);
    expect(result).toEqual({ DomainName: expected });
  });
});
describe('The generate certificate step', () => {
  it.todo('should check that the matching certificate is issued');
  it.todo('should throw if the matching certificate is pending validation');
  it.todo('should throw if the matching certificate is not validated');
  it.todo('should create the direct upper level wildcard certificate if no matching certificate');
  it.todo('should create the DNS record with the right parameters');
  it.todo('should poll every minutes to check if the certificate is created');
  it.todo('should succeed if certificate is issued within 5 minutes');
  it.todo('should throw if certificate is not issued within 5 minutes');
});
*/
