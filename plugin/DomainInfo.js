"use strict";
class DomainInfo {
    constructor(data) {
        this.defaultHostedZoneId = "Z2FDTNDATAQYW2";
        this.defaultSecurityPolicy = "TLS_1_2";
        this.domainName = data.distributionDomainName || data.regionalDomainName;
        this.hostedZoneId = data.distributionHostedZoneId ||
            data.regionalHostedZoneId ||
            this.defaultHostedZoneId;
        this.securityPolicy = data.securityPolicy || this.defaultSecurityPolicy;
    }
}
module.exports = DomainInfo;
//# sourceMappingURL=DomainInfo.js.map