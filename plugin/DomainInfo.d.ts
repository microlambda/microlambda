declare class DomainInfo {
    domainName: string;
    hostedZoneId: string;
    securityPolicy: string;
    private defaultHostedZoneId;
    private defaultSecurityPolicy;
    constructor(data: any);
}
export = DomainInfo;
