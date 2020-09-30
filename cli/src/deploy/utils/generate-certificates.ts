/* eslint-disable no-console */
import { ACM, Route53 } from 'aws-sdk';
import {
  CertificateSummary,
  DescribeCertificateResponse,
  ListCertificatesResponse,
  RequestCertificateResponse,
  ResourceRecord,
} from 'aws-sdk/clients/acm';
import { HostedZone } from 'aws-sdk/clients/route53';
import { RecordsManager } from './create-cname-records';
import { ILernaPackage, LernaHelper } from '../../utils/lerna';
import { ConfigReader } from '../../config/read-config';

export class CertificateManager {
  private readonly _services: ILernaPackage[];
  private readonly _configReader: ConfigReader;

  constructor(services: ILernaPackage[], configReader: ConfigReader) {
    this._services = services;
    this._configReader = configReader;
  }

  public async requestCertificates(stage: string): Promise<void> {
    for (const service of this._services) {
      const domain = LernaHelper.getCustomDomain(service.name, stage);
      if (!domain) {
        console.info(`No custom domain for service ${service.name}. Skipping`);
        continue;
      }
      const regions = await this._configReader.getRegions(service.name, stage);
      for (const region of regions) {
        const certificate = await this.getClosestCertificate(region, domain);
        if (!certificate) {
          const segments = domain.split('.');
          segments.shift();
          const targetDomain = ['*', ...segments].join('.');
          console.info('Creating certificate', { region, domain: targetDomain });
          const response = await this.createCertificate(region, targetDomain);
          console.info('Certificate created', response.CertificateArn);
          console.info('Activating certificate');
          await this.activateCertificate(domain, region, response.CertificateArn);
        } else {
          const details = await this.describeCertificate(region, certificate.CertificateArn);
          if (details.Certificate.Status !== 'ISSUED') {
            console.error('Cannot use existing certificate: certificate status is not ISSUED', {
              arn: details.Certificate.CertificateArn,
              status: details.Certificate.Status,
            });
            throw Error('E_CERTIFICATE_NOT_ISSUED');
          }
          console.info('Using already existing certificate', details.Certificate.CertificateArn);
        }
      }
    }
  }

  public async describeCertificate(region: string, arn: string): Promise<DescribeCertificateResponse> {
    const acm = new ACM({ region });
    return acm
      .describeCertificate({
        CertificateArn: arn,
      })
      .promise();
  }

  public async getClosestCertificate(region: string, domain: string): Promise<CertificateSummary> {
    const certificates = await this.listCertificates(region);
    // Exact match
    if (certificates.some((c) => c.DomainName === domain)) {
      console.debug('Exact match', certificates.find((c) => c.DomainName === domain).DomainName);
      return certificates.find((c) => c.DomainName === domain);
    }

    // Upper level wildcard
    const segments = domain.split('.');
    segments.shift();
    const wildcard = ['*', ...segments].join('.');
    if (certificates.some((c) => c.DomainName === wildcard)) {
      console.debug('Upper wildcard match', certificates.find((c) => c.DomainName === wildcard).DomainName);
      return certificates.find((c) => c.DomainName === wildcard);
    }
    // Upper level wildcards
    /*const segments = domain.split('.');
    while (segments.length > 2) {
      segments.shift();
      const wildcard = ['*', ...segments].join('.');
      if (certificates.some((c) => c.DomainName === wildcard)) {
        console.debug('Upper wildcard match', certificates.find((c) => c.DomainName === wildcard).DomainName);
        return certificates.find((c) => c.DomainName === wildcard);
      }
    }*/
    return null;
  }

  public async listCertificates(region: string): Promise<CertificateSummary[]> {
    const acm = new ACM({ region });
    let nextToken = null;
    const certificates: CertificateSummary[] = [];
    do {
      const result: ListCertificatesResponse = await acm
        .listCertificates({
          NextToken: nextToken,
        })
        .promise();
      certificates.push(...result.CertificateSummaryList);
      nextToken = result.NextToken;
    } while (nextToken != null);
    return certificates;
  }

  public async createCertificate(region: string, targetDomain: string): Promise<RequestCertificateResponse> {
    const acm = new ACM({ region });
    return acm
      .requestCertificate({
        DomainName: targetDomain,
        ValidationMethod: 'DNS',
      })
      .promise();
  }

  public async activateCertificate(domain: string, region: string, arn: string, polling = 20000): Promise<void> {
    // workaround pb with SDK: @see https://github.com/aws/aws-sdk-js/issues/2133
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const details = await this.describeCertificate(region, arn);
    console.debug(JSON.stringify(details, null, 2));
    const record = details.Certificate.DomainValidationOptions.find((dv) => dv.ResourceRecord).ResourceRecord;
    const dnsManager = new RecordsManager();
    const hostedZone = await dnsManager.getHostedZone(domain);
    const throwError = (): void => {
      console.error('Cannot activate certificate. Related hosted zone not found on Route53');
      console.error('Ask your domain administrator to create the following CNAME record and re-run deployment');
      console.error(record);
      throw Error('E_CERTIFICATE_ACTIVATION');
    };
    if (!hostedZone) {
      throwError();
    }
    console.info('Found related hosted zone', hostedZone);
    try {
      await this.createActivationRecord(hostedZone, record);
      console.info('Create DNS record to activate certificate');
    } catch (e) {
      console.error(e);
      throwError();
    }
    console.info('Waiting for the certificate to be active. Please wait this can take up to 30 minutes');

    return new Promise<void>((resolve, reject) => {
      const poll = setInterval(async () => {
        const details = await this.describeCertificate(region, arn);
        console.log('Status', details.Certificate.Status);
        if (details.Certificate.Status === 'ISSUED') {
          clearInterval(poll);
          return resolve();
        }
      }, polling);

      const THIRTY_MINUTES = 30 * 60 * 1000;
      setTimeout(() => {
        clearInterval(poll);
        console.error('Certificate was not issued within thirty minutes');
        console.error('Please double-check that the correct activation record have been created');
        return reject(Error('E_CERTIFICATE_ACTIVATION'));
      }, THIRTY_MINUTES);
    });
  }

  public async createActivationRecord(hostedZone: HostedZone, record: ResourceRecord): Promise<void> {
    const route53 = new Route53();
    await route53
      .changeResourceRecordSets({
        HostedZoneId: hostedZone.Id,
        ChangeBatch: {
          Changes: [
            {
              Action: 'UPSERT',
              ResourceRecordSet: {
                Name: record.Name,
                Type: record.Type,
                TTL: 300,
                ResourceRecords: [{ Value: record.Value }],
              },
            },
          ],
        },
      })
      .promise();
  }
}
