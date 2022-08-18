import { createActivationRecord } from "./create-activation-record";
import { getHostedZone } from "./get-hosted-zone";
import { createLatencyRecord } from "./create-records";
import { deleteLatencyRecords } from "./delete-records";

export const route53 = {
  createActivationRecord,
  getHostedZone,
  createLatencyRecord,
  deleteLatencyRecords
}
