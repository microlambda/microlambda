import { ConfigReader } from '../../config/read-config';
import { Service } from '../../graph';
import { Logger } from '../../logger';
import { Observable } from 'rxjs';
export declare enum CertificateEventType {
    CREATING = 0,
    CREATED = 1,
    ACTIVATING = 2,
    ACTIVATED = 3
}
export interface ICertificateEvent {
    type: CertificateEventType;
    region: string;
    domain: string;
}
export declare class CertificateManager {
    private readonly _services;
    private readonly _configReader;
    private readonly _logger;
    private readonly _certificates;
    constructor(logger: Logger, services: Service[], configReader: ConfigReader);
    prepareCertificatesRequests(stage: string): Promise<boolean>;
    doRequestCertificates(): Observable<ICertificateEvent>;
    private static _describeCertificate;
    private _getClosestCertificate;
    private static _listCertificates;
    private static _createCertificate;
    private _activateCertificate;
    private static _createActivationRecord;
}
