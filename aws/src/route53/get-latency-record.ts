import { IBaseLogger } from "@microlambda/types";
import {
  Route53Client,
  ResourceRecordSet,
  ListResourceRecordSetsRequest,
  ListResourceRecordSetsCommand,
} from "@aws-sdk/client-route-53";
import { serviceName } from "./service-name";
import { maxAttempts } from "../max-attempts";

export const getLatencyRecord = async (
  hostedZoneId: string,
  domain: string,
  apiGatewayUrl: string,
  region: string,
  logger?: IBaseLogger
): Promise<ResourceRecordSet | undefined> => {
  const route53 = new Route53Client({
    maxAttempts: maxAttempts({ apiRateLimit: 5 }, logger),
  });
  let nextRecordName: string | undefined;
  let nextRecordType: string | undefined;
  let isTruncated: boolean | undefined;
  let i = 0;
  let found: ResourceRecordSet | undefined;
  logger?.debug("Fetching resource records");
  do {
    i++;
    logger?.debug("Listing records", {
      page: i,
      isTruncated,
      nextRecordType,
      nextRecordName,
      hostedZoneId,
    });
    const params: ListResourceRecordSetsRequest = {
      HostedZoneId: hostedZoneId,
      StartRecordName: nextRecordName,
      StartRecordType: nextRecordType,
    };
    logger?.debug(serviceName, "Sending ListResourceRecordSetsCommand", params);
    const result = await route53.send(
      new ListResourceRecordSetsCommand(params)
    );
    found = result.ResourceRecordSets?.find(
      (r) =>
        r.Type === "CNAME" &&
        r.Name === (domain.endsWith(".") ? domain : domain) + "." &&
        r.Region === region &&
        r.ResourceRecords &&
        r.ResourceRecords.some((rr) => rr.Value === apiGatewayUrl)
    );
    logger?.debug(`Updating next token`, result.NextRecordIdentifier);
    isTruncated = result.IsTruncated;
    nextRecordName = result.NextRecordName;
    nextRecordType = result.NextRecordType;
  } while (isTruncated && !found);
  return found;
};
