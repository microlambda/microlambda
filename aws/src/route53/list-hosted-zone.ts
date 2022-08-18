import { IBaseLogger } from "@microlambda/types";
import {
  HostedZone,
  ListHostedZonesCommand,
  ListHostedZonesRequest,
  Route53Client,
} from "@aws-sdk/client-route-53";
import { serviceName } from "./service-name";
import { maxAttempts } from "../max-attempts";

export const listHostedZones = async (
  logger?: IBaseLogger
): Promise<Array<HostedZone>> => {
  const route53 = new Route53Client({
    maxAttempts: maxAttempts({ apiRateLimit: 5 }, logger),
  });
  let nextToken: string | undefined;
  const hostedZones: HostedZone[] = [];
  let i = 0;
  logger?.debug("Fetching hosted zones");
  do {
    i++;
    logger?.debug("Listing hosted zone", { page: i, nextToken });
    const params: ListHostedZonesRequest = {
      Marker: nextToken,
    };
    logger?.debug(serviceName, "Sending ListHostedZonesCommand", params);
    const result = await route53.send(new ListHostedZonesCommand(params));
    if (result.HostedZones) {
      hostedZones.push(...result.HostedZones);
      logger?.debug(`Found ${result.HostedZones.length} results`);
    }
    logger?.debug(`Updating next token`, result.NextMarker);
    nextToken = result.NextMarker;
  } while (nextToken != null);
  return hostedZones;
};
