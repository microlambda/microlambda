export interface ServerlessInstance {
    service: {
        service: string;
        provider: {
            stage: string;
            stackName: string;
            compiledCloudFormationTemplate: {
                Outputs: any;
            };
            apiGateway: {
                restApiId: string;
            };
        };
        custom: {
            customDomain: {
                domainName: string;
                basePath: string | undefined;
                stage: string | undefined;
                certificateName: string | undefined;
                certificateArn: string | undefined;
                createRoute53Record: boolean | undefined;
                endpointType: string | undefined;
                hostedZoneId: string | undefined;
                hostedZonePrivate: boolean | undefined;
                enabled: boolean | string | undefined;
                securityPolicy: string | undefined;
            };
        };
    };
    providers: {
        aws: {
            sdk: {
                APIGateway: any;
                Route53: any;
                CloudFormation: any;
                ACM: any;
                config: {
                    update(toUpdate: object): void;
                };
            };
            getCredentials(): any;
            getRegion(): any;
        };
    };
    cli: {
        log(str: string, entity?: string): any;
        consoleLog(str: any): any;
    };
}
export interface ServerlessOptions {
    stage: string;
}
