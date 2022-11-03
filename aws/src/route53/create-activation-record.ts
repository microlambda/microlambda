import {
  ChangeResourceRecordSetsCommand,
  ChangeResourceRecordSetsRequest,
  HostedZone,
  Route53Client,
} from "@aws-sdk/client-route-53";
import { ResourceRecord } from "@aws-sdk/client-acm";
import { serviceName } from "../certificate-manager/service-name";
import { IBaseLogger } from "@microlambda/types";
import { maxAttempts } from "../max-attempts";

export const createActivationRecord = async (
  hostedZone: HostedZone,
  record: ResourceRecord,
  logger?: IBaseLogger
): Promise<void> => {
  const route53 = new Route53Client({
    maxAttempts: maxAttempts({ apiRateLimit: 5 }, logger),
  });
  const request: ChangeResourceRecordSetsRequest = {
    HostedZoneId: hostedZone.Id,
    ChangeBatch: {
      Changes: [
        {
          Action: "UPSERT",
          ResourceRecordSet: {
            Name: record.Name,
            Type: record.Type,
            TTL: 300,
            ResourceRecords: [{ Value: record.Value }],
          },
        },
      ],
    },
  };
  logger?.debug(
    serviceName,
    "Sending ChangeResourceRecordSetsCommand",
    request
  );
  try {
    await route53.send(new ChangeResourceRecordSetsCommand(request));
  } catch (e) {
    logger?.error(serviceName, "ChangeResourceRecordSetsCommand failed");
    logger?.error(e);
    throw e;
  }
};
