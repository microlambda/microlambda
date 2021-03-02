import { APIGateway, AWSError, Route53 } from 'aws-sdk';
import { Change, HostedZone, ListHostedZonesResponse, ResourceRecordSet } from 'aws-sdk/clients/route53';
import { inspect } from 'util';
import { DomainName } from 'aws-sdk/clients/apigateway';
import { ConfigReader } from '../../config/read-config';
import { Service } from '../../graph';
import { getServiceName } from '../../yaml';
import { ILogger, Logger } from '../../logger';
import { PromiseResult } from 'aws-sdk/lib/request';

export class RecordsManager {
  private readonly _route53 = new Route53();
  private readonly _logger: ILogger;

  constructor(logger: Logger) {
    this._logger = logger.log('dns');
  }

  public async _exponentialBackoff<T>(action: () => Promise<PromiseResult<T, AWSError>>): Promise<T> {
    const maxRetries = 5;
    let tries = 0;
    const firstIncrement = 500;
    let delay = 0;
    let hasSucceed = false;
    let result: T | null = null;
    let lastError: Error = new Error(`Action failed after ${maxRetries} tries`);
    this._logger.debug(`Performing action with exponential backoff`, { maxRetries, firstIncrement });
    while (tries < maxRetries && !hasSucceed) {
      this._logger.debug(`Performing action: try ${tries}/${maxRetries} (delayed ${delay}ms)`);
      tries++;
      await new Promise<void>((resolve, reject) => {
        setTimeout(async () => {
          try {
            result = await action();
            this._logger.debug('Action has succeed !');
            hasSucceed = true;
            return resolve();
          } catch (e) {
            this._logger.debug('Action has failed !', e);
            lastError = e;
            if (e.retryable) {
              this._logger.debug('Action is retryable');
              if (e.retryDelay) {
                delay = 1000 * e.retryDelay;
              } else {
                delay = !delay ? firstIncrement : 2 * delay;
              }
              this._logger.debug('Delay updated, ready for another try');
              return resolve();
            } else {
              this._logger.error('Action is not retryable, rejecting', e);
              return reject(e);
            }
          }
        }, delay);
      });
    }
    if (!hasSucceed) {
      this._logger.error(`Action failed after ${maxRetries} tries, rejecting`);
      throw lastError;
    } else {
      return (result as unknown) as T;
    }
  }

  public async deleteBasePathMapping(region: string, domain: string): Promise<void> {
    const apiGateway = new APIGateway({ region });
    const params = {
      domainName: domain /* required */,
    };
    const data = await apiGateway.getBasePathMappings(params).promise();
    this._logger.info('Found base path mappings', data);
    if (!data.items) {
      this._logger.info('Nothing to do');
      return;
    }
    for (const item of data.items) {
      if (item.basePath) {
        const params = {
          basePath: item.basePath /* required */,
          domainName: domain /* required */,
        };
        await apiGateway.deleteBasePathMapping(params).promise();
      }
    }
  }

  public async createRecords(configReader: ConfigReader, stage: string, services: Service[]): Promise<void> {
    for (const service of services) {
      const regions = await configReader.getRegions(service.getName(), stage);
      const domain = configReader.getCustomDomain(service.getName(), stage);
      if (!domain) {
        this._logger.info(`No custom domain set for ${service.getName()}. Skipping`);
        continue;
      }
      const toCreate: Change[] = [];
      const hostedZone = await this.getHostedZone(domain);
      if (!hostedZone) {
        throw new Error('Cannot find hosted zone for domain ' + domain);
      }
      const records = await this.listRecords(hostedZone);
      const serviceName = getServiceName(service) + '-' + stage;

      for (const region of regions) {
        const apiGatewayDomain = await RecordsManager._getDomain(region, domain);
        if (!apiGatewayDomain) {
          throw Error('API Gateway domain does not exist');
        }
        const apiGatewayUrl = apiGatewayDomain.regionalDomainName;
        if (!apiGatewayUrl) {
          this._logger.error('Cannot resolve API Gateway url for service', service.getName());
          throw Error('Cannot resolve API gateway URL for service ' + service.getName());
        }
        const hasRecord = await this._recordExists(records, domain, apiGatewayUrl, region);
        if (!hasRecord) {
          const record = await RecordsManager._createRecord(domain, apiGatewayUrl, region, serviceName);
          toCreate.push(record);
        } else {
          this._logger.info('Record already exist', {
            region,
            apiGatewayUrl,
            domain,
          });
        }
      }
      this._logger.debug(inspect(toCreate, false, null, true));
      if (toCreate.length > 0) {
        this._logger.info('Creating missing records');
        await this._exponentialBackoff(async () => {
          return this._route53
            .changeResourceRecordSets({
              HostedZoneId: hostedZone.Id,
              ChangeBatch: {
                Changes: toCreate,
              },
            })
            .promise();
        });
      }
    }
  }

  public async deleteRecords(region: string, domain: string): Promise<void> {
    const hostedZone = await this.getHostedZone(domain);
    if (!hostedZone) {
      throw Error(`Cannot find hosted zone for domain ${domain}`);
    }
    const nextRecord: { name: string | undefined; type: string | undefined } = {
      name: undefined,
      type: undefined,
    };
    const records: ResourceRecordSet[] = [];
    do {
      const result = await this._route53
        .listResourceRecordSets({
          HostedZoneId: hostedZone.Id,
          StartRecordType: nextRecord.type,
          StartRecordName: nextRecord.name,
        })
        .promise();
      records.push(...result.ResourceRecordSets);
      if (result.IsTruncated) {
        nextRecord.type = result.NextRecordType;
        nextRecord.name = result.NextRecordName;
      } else {
        nextRecord.name = undefined;
        nextRecord.type = undefined;
      }
    } while (nextRecord.type && nextRecord.name);
    const toDelete = records.filter((r) => r.Name.startsWith(domain) && r.Region === region);
    this._logger.info({ toDelete });
    const actions = toDelete.map((r) => ({
      Action: 'DELETE',
      ResourceRecordSet: {
        Name: domain,
        Type: 'CNAME',
        TTL: 300,
        SetIdentifier: r.SetIdentifier,
        Region: r.Region,
        ResourceRecords: r.ResourceRecords,
      },
    }));
    this._logger.info({ actions });
    if (actions.length > 0) {
      await this._route53
        .changeResourceRecordSets({
          HostedZoneId: hostedZone.Id,
          ChangeBatch: {
            Changes: actions,
          },
        })
        .promise();
    }
  }

  public async getHostedZone(domain: string): Promise<HostedZone | undefined> {
    const hostedZones = await this._listHostedZones();
    const segments = domain.split('.');
    while (segments.length > 1) {
      const zoneName = segments.join('.') + '.';
      if (hostedZones.some((hz) => hz.Name === zoneName)) {
        return hostedZones.find((hz) => hz.Name === zoneName);
      }
      segments.shift();
    }
    return undefined;
  }

  public async listRecords(hz: HostedZone): Promise<ResourceRecordSet[]> {
    const nextRecord: { name?: string; type?: string } = {};
    const records: ResourceRecordSet[] = [];
    this._logger.debug('Listing records for hosted zone', hz);
    let i = 0;
    do {
      i++;
      this._logger.debug('Listing hosted zone', { page: i, nextRecord });
      const result = await this._exponentialBackoff(() => {
        return this._route53
          .listResourceRecordSets({
            HostedZoneId: hz.Id,
            StartRecordType: nextRecord.type,
            StartRecordName: nextRecord.name,
          })
          .promise();
      });
      records.push(...result.ResourceRecordSets);
      this._logger.debug(`Found ${result.ResourceRecordSets.length} results`);
      this._logger.debug('Has next page', result.IsTruncated);
      if (result.IsTruncated) {
        nextRecord.type = result.NextRecordType;
        nextRecord.name = result.NextRecordName;
      } else {
        nextRecord.type = undefined;
        nextRecord.name = undefined;
      }
    } while (nextRecord.type && nextRecord.name);
    return records;
  }

  private static async _getDomain(region: string, domainName: string): Promise<DomainName | null> {
    const apiGateway = new APIGateway({ region });
    try {
      return apiGateway.getDomainName({ domainName }).promise();
    } catch (e) {
      if (e.code === 'NotFoundException') {
        return null;
      }
      throw e;
    }
  }

  private async _recordExists(
    records: ResourceRecordSet[],
    domain: string,
    apiGateWayUrl: string,
    region: string,
  ): Promise<boolean> {
    return records.some(
      (r) =>
        r.Type === 'CNAME' &&
        r.Name === (domain.endsWith('.') ? domain : domain) + '.' &&
        r.Region === region &&
        r.ResourceRecords &&
        r.ResourceRecords.some((rr) => rr.Value === apiGateWayUrl),
    );
  }

  private static async _createRecord(
    domain: string,
    apiGateWayUrl: string,
    region: string,
    serviceName: string,
  ): Promise<Change> {
    return {
      Action: 'UPSERT',
      ResourceRecordSet: {
        Name: domain,
        Type: 'CNAME',
        TTL: 300,
        SetIdentifier: `${serviceName}-${region}`,
        Region: region,
        ResourceRecords: [{ Value: apiGateWayUrl }],
      },
    };
  }

  private async _listHostedZones(): Promise<Array<HostedZone>> {
    let nextToken: string | undefined;
    const hostedZones: HostedZone[] = [];
    let i = 0;
    this._logger.debug('Fetching hosted zones');
    do {
      i++;
      this._logger.debug('Listing hosted zone', { page: i, nextToken });
      const result: ListHostedZonesResponse = await this._exponentialBackoff(() => {
        return this._route53
          .listHostedZones({
            Marker: nextToken,
          })
          .promise();
      });
      hostedZones.push(...result.HostedZones);
      this._logger.debug(`Found ${result.HostedZones.length} results, updating next token`, result.NextMarker);
      nextToken = result.NextMarker;
    } while (nextToken != null);
    return hostedZones;
  }
}
