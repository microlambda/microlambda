"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecordsManager = void 0;
const aws_sdk_1 = require("aws-sdk");
const util_1 = require("util");
const yaml_1 = require("../../yaml");
class RecordsManager {
    constructor(logger) {
        this._route53 = new aws_sdk_1.Route53();
        this._logger = logger.log('dns');
    }
    async createRecords(configReader, stage, services) {
        for (const service of services) {
            const regions = await configReader.getRegions(service.getName(), stage);
            const domain = configReader.getCustomDomain(service.getName(), stage);
            if (!domain) {
                this._logger.info(`No custom domain set for ${service.getName()}. Skipping`);
                continue;
            }
            const toCreate = [];
            const hostedZone = await this.getHostedZone(domain);
            const records = await this.listRecords(hostedZone);
            const serviceName = yaml_1.getServiceName(service) + '-' + stage;
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
                }
                else {
                    this._logger.info('Record already exist', { region, apiGatewayUrl, domain });
                }
            }
            this._logger.debug(util_1.inspect(toCreate, false, null, true));
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
    async getHostedZone(domain) {
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
    async listRecords(hz) {
        const nextRecord = {
            name: null,
            type: null,
        };
        const records = [];
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
            }
            else {
                nextRecord.name = null;
                nextRecord.type = null;
            }
        } while (nextRecord.type && nextRecord.name);
        return records;
    }
    async _getDomain(region, domainName) {
        const apiGateway = new aws_sdk_1.APIGateway({ region });
        try {
            return apiGateway.getDomainName({ domainName }).promise();
        }
        catch (e) {
            if (e.code === 'NotFoundException') {
                return null;
            }
            throw e;
        }
    }
    async _recordExists(records, domain, apiGateWayUrl, region) {
        return records.some((r) => r.Type === 'CNAME' &&
            r.Name === (domain.endsWith('.') ? domain : domain) + '.' &&
            r.Region === region &&
            r.ResourceRecords.some((rr) => rr.Value === apiGateWayUrl));
    }
    async _createRecord(domain, apiGateWayUrl, region, serviceName) {
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
    async _listHostedZones() {
        let nextToken = null;
        const hostedZones = [];
        do {
            const result = await this._route53
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
exports.RecordsManager = RecordsManager;
//# sourceMappingURL=create-cname-records.js.map