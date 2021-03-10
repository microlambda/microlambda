import { ILogger } from "../../types";
import {
  ChangeResourceRecordSetsCommand,
  ChangeResourceRecordSetsRequest,
  Route53Client,
} from "@aws-sdk/client-route-53";
import { serviceName } from "./service-name";
import { beforeChangeRecords } from "./before-change-records";
import { getLatencyRecord } from "./get-latency-record";

export const createLatencyRecord = async (
  region: string,
  domain: string,
  identifier?: string,
  logger?: ILogger
): Promise<void> => {
  const { hostedZoneId, apiGatewayUrl } = await beforeChangeRecords(
    region,
    domain,
    logger
  );
  const exists = await getLatencyRecord(
    hostedZoneId,
    domain,
    apiGatewayUrl,
    region,
    logger
  );
  if (exists) {
    logger?.info("Latency DNS Record already exists");
    return;
  }
  const route53 = new Route53Client({ maxAttempts: 5 });
  const params: ChangeResourceRecordSetsRequest = {
    HostedZoneId: hostedZoneId,
    ChangeBatch: {
      Changes: [
        {
          Action: "UPSERT",
          ResourceRecordSet: {
            Name: domain,
            Type: "CNAME",
            TTL: 300,
            SetIdentifier: identifier || `${domain}-${region}`,
            Region: region,
            ResourceRecords: [{ Value: apiGatewayUrl }],
          },
        },
      ],
    },
  };
  logger?.debug(serviceName, "Sending ChangeResourceRecordSetsCommand", params);
  try {
    await route53.send(new ChangeResourceRecordSetsCommand(params));
  } catch (e) {
    logger?.error(serviceName, "ChangeResourceRecordSetsCommand failed");
    logger?.error(e);
    throw e;
  }
};
