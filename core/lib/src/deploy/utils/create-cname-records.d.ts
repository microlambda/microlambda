import { HostedZone, ResourceRecordSet } from 'aws-sdk/clients/route53';
import { ConfigReader } from '../../config/read-config';
import { Service } from '../../graph';
import { Logger } from '../../logger';
export declare class RecordsManager {
    private readonly _route53;
    private readonly _logger;
    constructor(logger: Logger);
    createRecords(configReader: ConfigReader, stage: string, services: Service[]): Promise<void>;
    getHostedZone(domain: string): Promise<HostedZone>;
    listRecords(hz: HostedZone): Promise<ResourceRecordSet[]>;
    private _getDomain;
    private _recordExists;
    private _createRecord;
    private _listHostedZones;
}
