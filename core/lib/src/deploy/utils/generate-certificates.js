"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CertificateManager = exports.CertificateEventType = void 0;
const aws_sdk_1 = require("aws-sdk");
const create_cname_records_1 = require("./create-cname-records");
const logger_1 = require("../../logger");
const rxjs_1 = require("rxjs");
var CertificateEventType;
(function (CertificateEventType) {
    CertificateEventType[CertificateEventType["CREATING"] = 0] = "CREATING";
    CertificateEventType[CertificateEventType["CREATED"] = 1] = "CREATED";
    CertificateEventType[CertificateEventType["ACTIVATING"] = 2] = "ACTIVATING";
    CertificateEventType[CertificateEventType["ACTIVATED"] = 3] = "ACTIVATED";
})(CertificateEventType = exports.CertificateEventType || (exports.CertificateEventType = {}));
class CertificateManager {
    constructor(logger, services, configReader) {
        this._services = services;
        this._configReader = configReader;
        this._logger = logger.log('certificates');
        this._certificates = new Map();
    }
    async prepareCertificatesRequests(stage) {
        let needAction = false;
        for (const service of this._services) {
            const domain = this._configReader.getCustomDomain(service.getName(), stage);
            if (!domain) {
                this._logger.info(`No custom domain for service ${service.getName()}. Skipping`);
                continue;
            }
            const regions = await this._configReader.getRegions(service.getName(), stage);
            for (const region of regions) {
                if (!this._certificates.has(region)) {
                    this._certificates.set(region, new Set());
                }
                const regionCertificates = this._certificates.get(region);
                const certificate = await this._getClosestCertificate(region, domain);
                if (!certificate) {
                    const segments = domain.split('.');
                    segments.shift();
                    const targetDomain = ['*', ...segments].join('.');
                    this._logger.info('Creating certificate', { region, domain: targetDomain });
                    regionCertificates.add(targetDomain);
                    needAction = true;
                }
                else {
                    const details = await CertificateManager._describeCertificate(region, certificate.CertificateArn);
                    if (details.Certificate.Status !== 'ISSUED') {
                        this._logger.error('Cannot use existing certificate: certificate status is not ISSUED', {
                            arn: details.Certificate.CertificateArn,
                            status: details.Certificate.Status,
                        });
                        throw Error('E_CERTIFICATE_NOT_ISSUED');
                    }
                    this._logger.info('Using already existing certificate', details.Certificate.CertificateArn);
                }
            }
        }
        return needAction;
    }
    doRequestCertificates() {
        return new rxjs_1.Observable((obs) => {
            const promises = [];
            for (const [region, domains] of this._certificates.entries()) {
                for (const domain of domains) {
                    obs.next({ type: CertificateEventType.CREATING, domain, region });
                    const createCertificate = CertificateManager._createCertificate(region, domain);
                    promises.push(createCertificate);
                    createCertificate
                        .then((response) => {
                        obs.next({ type: CertificateEventType.CREATED, domain, region });
                        this._logger.info('Certificate created', response.CertificateArn);
                        this._logger.info('Activating certificate');
                        obs.next({ type: CertificateEventType.ACTIVATING, domain, region });
                        const activateCertificate = this._activateCertificate(domain, region, response.CertificateArn);
                        promises.push(activateCertificate);
                        activateCertificate
                            .then(() => {
                            obs.next({ type: CertificateEventType.ACTIVATED, domain, region });
                        })
                            .catch((err) => obs.error({ err, domain, region }));
                    })
                        .catch((err) => obs.error({ err, domain, region }));
                }
            }
            Promise.all(promises).then(() => obs.complete());
        });
    }
    static async _describeCertificate(region, arn) {
        const acm = new aws_sdk_1.ACM({ region });
        return acm
            .describeCertificate({
            CertificateArn: arn,
        })
            .promise();
    }
    async _getClosestCertificate(region, domain) {
        const certificates = await CertificateManager._listCertificates(region);
        if (certificates.some((c) => c.DomainName === domain)) {
            this._logger.debug('Exact match', certificates.find((c) => c.DomainName === domain).DomainName);
            return certificates.find((c) => c.DomainName === domain);
        }
        const segments = domain.split('.');
        segments.shift();
        const wildcard = ['*', ...segments].join('.');
        if (certificates.some((c) => c.DomainName === wildcard)) {
            this._logger.debug('Upper wildcard match', certificates.find((c) => c.DomainName === wildcard).DomainName);
            return certificates.find((c) => c.DomainName === wildcard);
        }
        return null;
    }
    static async _listCertificates(region) {
        const acm = new aws_sdk_1.ACM({ region });
        let nextToken = null;
        const certificates = [];
        do {
            const result = await acm
                .listCertificates({
                NextToken: nextToken,
            })
                .promise();
            certificates.push(...result.CertificateSummaryList);
            nextToken = result.NextToken;
        } while (nextToken != null);
        return certificates;
    }
    static async _createCertificate(region, targetDomain) {
        const acm = new aws_sdk_1.ACM({ region });
        return acm
            .requestCertificate({
            DomainName: targetDomain,
            ValidationMethod: 'DNS',
        })
            .promise();
    }
    async _activateCertificate(domain, region, arn, polling = 20000) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        const details = await CertificateManager._describeCertificate(region, arn);
        this._logger.debug(JSON.stringify(details, null, 2));
        const record = details.Certificate.DomainValidationOptions.find((dv) => dv.ResourceRecord).ResourceRecord;
        const dnsManager = new create_cname_records_1.RecordsManager(new logger_1.Logger());
        const hostedZone = await dnsManager.getHostedZone(domain);
        const throwError = () => {
            this._logger.error('Cannot activate certificate. Related hosted zone not found on Route53');
            this._logger.error('Ask your domain administrator to create the following CNAME record and re-run deployment');
            this._logger.error(record);
            throw Error('E_CERTIFICATE_ACTIVATION');
        };
        if (!hostedZone) {
            throwError();
        }
        this._logger.info('Found related hosted zone', hostedZone);
        try {
            await CertificateManager._createActivationRecord(hostedZone, record);
            this._logger.info('Create DNS record to activate certificate');
        }
        catch (e) {
            this._logger.error(e);
            throwError();
        }
        this._logger.info('Waiting for the certificate to be active. Please wait this can take up to 30 minutes');
        return new Promise((resolve, reject) => {
            const poll = setInterval(async () => {
                const details = await CertificateManager._describeCertificate(region, arn);
                this._logger.info('Status', details.Certificate.Status);
                if (details.Certificate.Status === 'ISSUED') {
                    clearInterval(poll);
                    return resolve();
                }
            }, polling);
            const THIRTY_MINUTES = 30 * 60 * 1000;
            setTimeout(() => {
                clearInterval(poll);
                this._logger.error('Certificate was not issued within thirty minutes');
                this._logger.error('Please double-check that the correct activation record have been created');
                return reject(Error('E_CERTIFICATE_ACTIVATION'));
            }, THIRTY_MINUTES);
        });
    }
    static async _createActivationRecord(hostedZone, record) {
        const route53 = new aws_sdk_1.Route53();
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
exports.CertificateManager = CertificateManager;
//# sourceMappingURL=generate-certificates.js.map