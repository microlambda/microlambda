export interface ServerlessInstance {
    service: {
        service: string
        provider: {
            stage: string
            stackName: string
            compiledCloudFormationTemplate: {
                Outputs: unknown,
            },
            apiGateway: {
                restApiId: string,
            },
        }
        custom: {
            customDomain: {
                domainName: string,
                basePath: string | undefined,
                stage: string | undefined,
                certificateName: string | undefined,
                certificateArn: string | undefined,
                createRoute53Record: boolean | undefined,
                endpointType: string | undefined,
                hostedZoneId: string | undefined,
                hostedZonePrivate: boolean | undefined,
                enabled: boolean | string | undefined,
                securityPolicy: string | undefined,
            },
        },
    };
    providers: {
        aws: {
            sdk: {
                APIGateway: unknown,
                Route53: unknown,
                CloudFormation: unknown,
                ACM: unknown,
                config: {
                    update(toUpdate: object): void,
                },
             }
            getCredentials(): unknown,
            getRegion(): unknown,
        },
    };
    cli: {
        log(...args: unknown[]): unknown,
        consoleLog(...args: unknown[]): unknown,
    };
    [key: string]: unknown;
}

export interface ServerlessOptions {
    stage: string;
}
