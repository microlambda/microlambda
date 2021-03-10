import { ILogger } from "../../types";
import { HostedZone } from "@aws-sdk/client-route-53";
import { listHostedZones } from "./list-hosted-zone";

export const getHostedZone = async (
  domain: string,
  logger?: ILogger
): Promise<HostedZone | undefined> => {
  const hostedZones = await listHostedZones(logger);
  const segments = domain.split(".");
  while (segments.length > 1) {
    const zoneName = segments.join(".") + ".";
    if (hostedZones.some((hz) => hz.Name === zoneName)) {
      return hostedZones.find((hz) => hz.Name === zoneName);
    }
    segments.shift();
  }
  return undefined;
};
