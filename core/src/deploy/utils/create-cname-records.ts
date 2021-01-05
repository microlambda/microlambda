import { APIGateway, Route53 } from 'aws-sdk';
import { Change, HostedZone, ListHostedZonesResponse, ResourceRecordSet } from 'aws-sdk/clients/route53';
import { inspect } from 'util';
import { DomainName } from 'aws-sdk/clients/apigateway';
import { ConfigReader } from '../../config/read-config';
import { Service } from '../../graph';
import { getServiceName } from '../../yaml';
import { ILogger, Logger } from '../../logger';

export class RecordsManager {
  private readonly _route53 = new Route53();
  private readonly _logger: ILogger;

  constructor(logger: Logger) {
    this._logger = logger.log('dns');
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
      const records = await this.listRecords(hostedZone);
      const serviceName = getServiceName(service) + '-' + stage;

      for (const region of regions) {
        const apiGatewayDomain = await this._getDomain(region, domain);
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
          const record = await this._createRecord(domain, apiGatewayUrl, region, serviceName);
          toCreate.push(record);
        } else {
          this._logger.info('Record already exist', { region, apiGatewayUrl, domain });
        }
      }
      this._logger.debug(inspect(toCreate, false, null, true));
      if (toCreate.length > 0) {
        this._logger.info('Creating missing records');
        await this._route53
          .changeResourceRecordSets({
            HostedZoneId: hostedZone.Id,
            ChangeBatch: {
              Changes: toCreate,
            },
          })
          .promise();
      }
    }
  }

  public async getHostedZone(domain: string): Promise<HostedZone> {
    const hostedZones = await this._listHostedZones();
    const segments = domain.split('.');
    while (segments.length > 1) {
      const zoneName = segments.join('.') + '.';
      if (hostedZones.some((hz) => hz.Name === zoneName)) {
        return hostedZones.find((hz) => hz.Name === zoneName);
      }
      segments.shift();
    }
    return null;
  }

  public async listRecords(hz: HostedZone): Promise<ResourceRecordSet[]> {
    const nextRecord: { name: string; type: string } = {
      name: null,
      type: null,
    };
    const records: ResourceRecordSet[] = [];
    do {
      const result = await this._route53
        .listResourceRecordSets({
          HostedZoneId: hz.Id,
          StartRecordType: nextRecord.type,
          StartRecordName: nextRecord.name,
        })
        .promise();
      records.push(...result.ResourceRecordSets);
      if (result.IsTruncated) {
        nextRecord.type = result.NextRecordType;
        nextRecord.name = result.NextRecordName;
      } else {
        nextRecord.name = null;
        nextRecord.type = null;
      }
    } while (nextRecord.type && nextRecord.name);
    return records;
  }

  private async _getDomain(region: string, domainName: string): Promise<DomainName> {
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

  /*private async _getApiGatewayUrl(region: string, serviceName: string): Promise<string> {
    const cf = new CloudFormation({ region });
    const stacks = await cf
      .describeStacks({
        StackName: serviceName,
      })
      .promise();
    const outputs = stacks.Stacks[0].Outputs;
    const output = outputs.find((o) => o.OutputKey === 'ServiceEndpoint');
    if (output != null) {
      this._logger.info(`${serviceName} [${region}] -> ${output.OutputValue}`);
    }
    return output != null ? output.OutputValue : null;
  }*/

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
        r.ResourceRecords.some((rr) => rr.Value === apiGateWayUrl),
    );
  }

  private async _createRecord(
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
    let nextToken = null;
    const hostedZones: HostedZone[] = [];
    do {
      const result: ListHostedZonesResponse = await this._route53
        .listHostedZones({
          Marker: nextToken,
        })
        .promise();
      hostedZones.push(...result.HostedZones);
      nextToken = result.NextMarker;
    } while (nextToken != null);
    return hostedZones;
  }
}
